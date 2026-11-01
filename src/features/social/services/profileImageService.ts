import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';
import { PickedImage } from '../../posts/postImages';

export type ProfileImageKind = 'avatar' | 'cover';

// The limits posts-api enforces, in MiB like the 1 MB of a post's images: a
// byte more is refused there, so there is no point sending it.
export const PROFILE_IMAGE_MAX_BYTES: Record<ProfileImageKind, number> = {
  avatar: 5 * 1_048_576,
  cover: 10 * 1_048_576,
};

// Up to 10 MB over a mobile connection: far past the 10 s default timeout.
const UPLOAD_TIMEOUT_MS = 120000;

const FAILED_UPLOAD: Record<ProfileImageKind, string> = {
  avatar: 'No se pudo subir la foto. Intentalo de nuevo.',
  cover: 'No se pudo subir la portada. Intentalo de nuevo.',
};

const FAILED_REMOVAL: Record<ProfileImageKind, string> = {
  avatar: 'No se pudo eliminar la foto. Intentalo de nuevo.',
  cover: 'No se pudo eliminar la portada. Intentalo de nuevo.',
};

// The caller's own photo and cover. Both live in posts-api, under
// /users/me: a format, a size or a content the server refuses comes back as a
// Problem Details 422 with a message already fit to show.
export const profileImageService = {
  // Uploads or replaces the image, one multipart part named `image`, and
  // returns the signed URL of the new one. The server deletes the old file.
  async upload(kind: ProfileImageKind, image: PickedImage): Promise<string> {
    try {
      const form = new FormData();
      // React Native's FormData reads a file from `{ uri, name, type }`,
      // which the DOM typings do not know about.
      form.append('image', {
        uri: image.uri,
        name: image.name,
        type: image.mimeType,
      } as unknown as Blob);
      // The body names its one field after the kind: { avatarUrl } or { coverUrl }.
      const field = `${kind}Url` as const;
      const response = await postsApiClient.put<Record<typeof field, string>>(
        `/users/me/${kind}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT_MS }
      );
      return response.data[field];
    } catch (error) {
      throw toAuthError(error, FAILED_UPLOAD[kind]);
    }
  },

  // Back to the default. The server answers 204 even when there was no image.
  async remove(kind: ProfileImageKind): Promise<void> {
    try {
      await postsApiClient.delete(`/users/me/${kind}`);
    } catch (error) {
      throw toAuthError(error, FAILED_REMOVAL[kind]);
    }
  },
};
