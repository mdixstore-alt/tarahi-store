# Tarahi product photos (staging)

Upload actual **JPG, PNG or WebP photos** into this directory using GitHub's Add file > Upload files.

- Best: use one folder per design (for example `product-photos/lemon-tee/` with front and back photos). The build chooses a cover photo for each folder.
- Photos directly inside this folder are also accepted; their filenames are used to group related views.
- A GitHub Actions build automatically removes photo metadata, resizes images, creates optimized WebP files, and generates a **draft** storefront catalog when photos are present.
- Do not upload the original 334 MB ZIP directly: GitHub restricts large files, and the ZIP cannot be processed here.
- Images may be uploaded in separate batches. Prefer individual photo files, each below GitHub's web-upload size limit.
- Product names, stock and prices are placeholders. Orders will stay disabled until the catalog and business phone are confirmed.
- Preview page at https://mdixstore-alt.github.io/tarahi-store/

**Never upload private customer photos, credentials or shipping details.**
