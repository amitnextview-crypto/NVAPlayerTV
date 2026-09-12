package com.signageplayertv;

import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.media.MediaScannerConnection;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Converts documents placed directly in nvsign section folders without involving the JS runtime.
 * Files are rendered into a hidden staging directory first.  The source is removed only after all
 * generated images have been decoded successfully and atomically moved beside it.
 */
final class SectionDocumentConverter {
    private static final String TAG = "SectionDocConverter";
    private static final int MAX_RENDER_EDGE = 1920;
    private static final long MIN_JPEG_BYTES = 128L;

    private SectionDocumentConverter() {
    }

    interface ProgressListener { void onProgress(int percent, String message); }

    static boolean convertPendingDocuments(Context context, File nvsignRoot) {
        return convertPendingDocuments(context, nvsignRoot, null);
    }

    static boolean convertPendingDocuments(Context context, File nvsignRoot, ProgressListener listener) {
        if (nvsignRoot == null || !nvsignRoot.isDirectory() || !nvsignRoot.canRead()) return false;
        int totalDocuments = countPdfDocuments(nvsignRoot);
        if (totalDocuments > 0 && listener != null) listener.onProgress(0, "PDF files found. Preparing conversion...");
        int[] completedDocuments = {0};
        boolean changed = false;
        for (int section = 1; section <= 3; section += 1) {
            File sectionDir = new File(nvsignRoot, "section" + section);
            changed |= convertFolder(context, sectionDir, listener, totalDocuments, completedDocuments);
        }
        if (totalDocuments > 0 && listener != null) listener.onProgress(100, "Images ready to play");
        return changed;
    }

    private static boolean convertFolder(Context context, File directory, ProgressListener listener, int totalDocuments, int[] completedDocuments) {
        if (directory == null || !directory.isDirectory() || !directory.canRead()) return false;
        cleanupInterruptedStaging(directory);
        boolean changed = false;
        File[] children = directory.listFiles();
        if (children == null) return false;
        Arrays.sort(children, Comparator.comparing(File::getName, String.CASE_INSENSITIVE_ORDER));
        for (File child : children) {
            if (child == null) continue;
            if (child.isDirectory()) {
                // Conversion staging is never treated as playable content or a source folder.
                if (!child.getName().startsWith(".nvsign-convert-")) changed |= convertFolder(context, child, listener, totalDocuments, completedDocuments);
                continue;
            }
            if (!child.isFile() || !child.canRead()) continue;
            String extension = extensionOf(child.getName());
            if ("pdf".equals(extension)) {
                changed |= convertPdf(context, child, listener, totalDocuments, completedDocuments[0]);
                completedDocuments[0] += 1;
            } else if (isOfficeExtension(extension)) {
                // Android has no built-in renderer for legacy Office, DOCX or PPTX. Keep the source
                // intact until a real renderer is supplied; deleting it would violate conversion safety.
                Log.w(TAG, "Office document retained (no native renderer configured): " + child.getAbsolutePath());
            }
        }
        return changed;
    }

    private static boolean convertPdf(Context context, File source, ProgressListener listener, int totalDocuments, int completedDocuments) {
        File parent = source.getParentFile();
        if (parent == null) return false;
        String base = baseName(source.getName());
        File staging = new File(parent, ".nvsign-convert-" + base + "-" + System.nanoTime());
        List<File> publishedImages = new ArrayList<>();
        List<File> targets = new ArrayList<>();
        List<File> previousImages = new ArrayList<>();
        ParcelFileDescriptor descriptor = null;
        PdfRenderer renderer = null;
        try {
            if (!staging.mkdirs()) throw new IOException("Unable to create conversion staging directory");
            descriptor = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(descriptor);
            int pageCount = renderer.getPageCount();
            if (pageCount <= 0) throw new IOException("PDF has no pages");
            reportProgress(listener, totalDocuments, completedDocuments, 0, pageCount, "Converting " + source.getName());

            List<File> stagedImages = new ArrayList<>();
            for (int index = 0; index < pageCount; index += 1) {
                PdfRenderer.Page page = renderer.openPage(index);
                Bitmap bitmap = null;
                try {
                    int[] dimensions = scaledDimensions(page.getWidth(), page.getHeight());
                    bitmap = Bitmap.createBitmap(dimensions[0], dimensions[1], Bitmap.Config.ARGB_8888);
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    File image = new File(staging, String.format(Locale.US, "%s_%03d.jpg", base, index + 1));
                    try (FileOutputStream output = new FileOutputStream(image)) {
                        if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)) {
                            throw new IOException("Unable to encode page " + (index + 1));
                        }
                        output.getFD().sync();
                    }
                    verifyImage(image);
                    stagedImages.add(image);
                    reportProgress(listener, totalDocuments, completedDocuments, index + 1, pageCount, "Converting " + source.getName());
                } finally {
                    if (bitmap != null) bitmap.recycle();
                    page.close();
                }
            }

            targets = buildTargets(parent, base, stagedImages.size());
            // A PDF may have been converted before but its source retained
            // after an interrupted USB write. Keep the previous JPGs as a
            // rollback until every fresh page is rendered and published.
            for (int index = 0; index < targets.size(); index += 1) {
                File target = targets.get(index);
                File previous = new File(staging, ".previous-" + index + ".jpg");
                if (target.exists()) {
                    if (!target.renameTo(previous)) {
                        throw new IOException("Unable to replace existing image: " + target.getName());
                    }
                    previousImages.add(previous);
                } else {
                    previousImages.add(null);
                }
            }
            for (int index = 0; index < stagedImages.size(); index += 1) {
                moveOrThrow(stagedImages.get(index), targets.get(index));
                publishedImages.add(targets.get(index));
                verifyImage(targets.get(index));
                reportProgress(listener, totalDocuments, completedDocuments, index + 1, pageCount, "Testing images " + source.getName());
            }
            if (!source.delete()) throw new IOException("Converted images were created but source could not be deleted");
            String[] mediaPaths = new String[targets.size()];
            for (int index = 0; index < targets.size(); index += 1) {
                mediaPaths[index] = targets.get(index).getAbsolutePath();
            }
            MediaScannerConnection.scanFile(context, mediaPaths, null, null);
            deleteDirectory(staging);
            Log.i(TAG, "Converted " + source.getAbsolutePath() + " into " + targets.size() + " JPG image(s)");
            return true;
        } catch (Exception error) {
            if (listener != null) listener.onProgress(Math.max(0, Math.min(99, (completedDocuments * 100) / Math.max(1, totalDocuments))), "Conversion failed: " + source.getName());
            Log.e(TAG, "Document conversion failed; source retained: " + source.getAbsolutePath(), error);
            // Do not leave a partial image sequence that the existing player could start showing.
            // These are only files this transaction moved after the source was retained.
            if (source.exists()) {
                for (File image : publishedImages) {
                    if (image.exists() && !image.delete()) {
                        Log.w(TAG, "Unable to remove incomplete conversion image: " + image.getAbsolutePath());
                    }
                }
                for (int index = 0; index < previousImages.size(); index += 1) {
                    File previous = previousImages.get(index);
                    if (previous == null || !previous.exists()) continue;
                    File target = targets.get(index);
                    if (target.exists() && !target.delete()) {
                        Log.w(TAG, "Unable to remove incomplete conversion image: " + target.getAbsolutePath());
                    }
                    if (!previous.renameTo(target)) {
                        Log.w(TAG, "Unable to restore previous conversion image: " + target.getAbsolutePath());
                    }
                }
            }
            deleteDirectory(staging);
            return false;
        } finally {
            if (renderer != null) renderer.close();
            if (descriptor != null) try { descriptor.close(); } catch (IOException ignored) { }
        }
    }

    private static void reportProgress(ProgressListener listener, int totalDocuments, int completedDocuments, int completedPages, int pageCount, String message) {
        if (listener == null) return;
        double fileProgress = Math.max(0d, Math.min(1d, (double) completedPages / Math.max(1, pageCount)));
        int percent = (int) Math.floor(((completedDocuments + fileProgress) * 100d) / Math.max(1, totalDocuments));
        listener.onProgress(Math.max(0, Math.min(99, percent)), message);
    }

    private static int countPdfDocuments(File directory) {
        if (directory == null || !directory.isDirectory() || !directory.canRead()) return 0;
        int count = 0;
        File[] children = directory.listFiles();
        if (children == null) return 0;
        for (File child : children) {
            if (child == null) continue;
            if (child.isDirectory()) {
                if (!child.getName().startsWith(".nvsign-convert-")) count += countPdfDocuments(child);
            } else if (child.isFile() && "pdf".equals(extensionOf(child.getName()))) count += 1;
        }
        return count;
    }

    private static List<File> buildTargets(File parent, String base, int count) {
        List<File> targets = new ArrayList<>();
        for (int index = 0; index < count; index += 1) {
            targets.add(new File(parent, String.format(Locale.US, "%s_%03d.jpg", base, index + 1)));
        }
        return targets;
    }

    private static int[] scaledDimensions(int width, int height) {
        int safeWidth = Math.max(1, width);
        int safeHeight = Math.max(1, height);
        float scale = Math.min(1f, (float) MAX_RENDER_EDGE / Math.max(safeWidth, safeHeight));
        return new int[]{Math.max(1, Math.round(safeWidth * scale)), Math.max(1, Math.round(safeHeight * scale))};
    }

    private static void verifyImage(File image) throws IOException {
        if (!image.isFile() || image.length() < MIN_JPEG_BYTES) throw new IOException("Image verification failed: " + image.getName());
        android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        android.graphics.BitmapFactory.decodeFile(image.getAbsolutePath(), options);
        if (options.outWidth <= 0 || options.outHeight <= 0) throw new IOException("Invalid image output: " + image.getName());
    }

    private static void moveOrThrow(File from, File to) throws IOException {
        if (!from.renameTo(to)) throw new IOException("Unable to publish generated image: " + to.getName());
    }

    private static void cleanupInterruptedStaging(File directory) {
        File[] children = directory.listFiles((dir, name) -> name.startsWith(".nvsign-convert-"));
        if (children == null) return;
        for (File child : children) deleteDirectory(child);
    }

    private static void deleteDirectory(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteDirectory(child);
        }
        if (!file.delete()) Log.w(TAG, "Unable to remove conversion temp file: " + file.getAbsolutePath());
    }

    private static String extensionOf(String name) {
        int dot = String.valueOf(name).lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.US);
    }

    private static String baseName(String name) {
        int dot = String.valueOf(name).lastIndexOf('.');
        String value = dot > 0 ? name.substring(0, dot) : name;
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static boolean isOfficeExtension(String extension) {
        return "ppt".equals(extension) || "pptx".equals(extension) || "doc".equals(extension) || "docx".equals(extension);
    }
}
