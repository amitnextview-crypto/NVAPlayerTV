export function buildPlaybackResumeKey(sectionIndex: number, identity: string) {
  return `playback:resume:section:${sectionIndex}:${identity}`;
}

export function getPlaylistAdvanceState(length: number, currentIndex: number) {
  if (length <= 0) {
    return { nextIndex: 0, wrappedToStart: false };
  }
  if (length === 1) {
    return { nextIndex: 0, wrappedToStart: false };
  }
  const safeCurrent = Math.max(0, Math.min(length - 1, currentIndex));
  const nextIndex = (safeCurrent + 1) % length;
  return {
    nextIndex,
    wrappedToStart: safeCurrent === length - 1 && nextIndex === 0,
  };
}
