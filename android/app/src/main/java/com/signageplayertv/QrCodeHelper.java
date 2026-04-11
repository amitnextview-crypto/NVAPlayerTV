package com.signageplayertv;

import android.graphics.Bitmap;
import android.util.Base64;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;

import java.io.ByteArrayOutputStream;

public final class QrCodeHelper {
    private QrCodeHelper() {
    }

    public static String buildQrDataUri(String value) {
        try {
            String input = String.valueOf(value == null ? "" : value).trim();
            if (input.isEmpty()) return "";
            BitMatrix matrix = new MultiFormatWriter().encode(input, BarcodeFormat.QR_CODE, 512, 512);
            Bitmap bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888);
            for (int x = 0; x < 512; x += 1) {
                for (int y = 0; y < 512; y += 1) {
                    bitmap.setPixel(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                }
            }
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
            return "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
            return "";
        }
    }
}
