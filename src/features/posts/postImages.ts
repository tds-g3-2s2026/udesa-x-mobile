export const MAX_POST_IMAGES = 4;
// The same number posts-api enforces: a byte more is refused there, so there
// is no point sending it.
export const MAX_IMAGE_BYTES = 1_048_576;

// What leaves the device for each attached image: where it is and how the
// server should see it. The real format is checked server-side from the
// content, so `mimeType` here only decides what the picker may offer.
export interface PickedImage {
  uri: string;
  name: string;
  mimeType: string;
}

// The slice of an expo-image-picker asset this module reads.
export interface PickerAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

function extensionOf(value: string): string {
  const clean = value.split('?')[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
}

function typeOf(asset: PickerAsset): string | undefined {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  return EXTENSION_TYPES[extensionOf(asset.fileName ?? asset.uri)];
}

export type RejectedReason = 'format' | 'size';

export interface PickResult {
  accepted: PickedImage[];
  rejected: { name: string; reason: RejectedReason }[];
}

// Keeps what fits: the right format, within 1 MB and while there is room in
// the post. A size the picker could not report passes on purpose, because the
// server measures the real bytes and answers with its own message; guessing
// here would block images that were fine.
export function acceptPickedImages(assets: PickerAsset[], alreadyAttached: number): PickResult {
  const accepted: PickedImage[] = [];
  const rejected: PickResult['rejected'] = [];

  for (const asset of assets) {
    const name = asset.fileName || asset.uri.split('/').pop() || 'imagen';
    const mimeType = typeOf(asset);
    if (!mimeType || !ACCEPTED_TYPES.includes(mimeType)) {
      rejected.push({ name, reason: 'format' });
    } else if (asset.fileSize !== undefined && asset.fileSize > MAX_IMAGE_BYTES) {
      rejected.push({ name, reason: 'size' });
    } else if (alreadyAttached + accepted.length < MAX_POST_IMAGES) {
      accepted.push({ uri: asset.uri, name, mimeType });
    }
  }

  return { accepted, rejected };
}
