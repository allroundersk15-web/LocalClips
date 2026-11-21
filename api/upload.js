
import { handleUpload } from '@vercel/blob/client';

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const expectedPassword = process.env.LOCALCLIPS_UPLOAD_PASSWORD;

        if (!expectedPassword) {
          throw new Error('Upload password is not configured');
        }

        let suppliedPassword = '';

        try {
          suppliedPassword = JSON.parse(clientPayload || '{}').password || '';
        } catch {
          throw new Error('Invalid upload authorization');
        }

        if (suppliedPassword !== expectedPassword) {
          throw new Error('Unauthorized upload');
        }

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'video/webm',
            'video/x-matroska',
            'video/*'
          ],
          maximumSizeInBytes: MAX_VIDEO_SIZE,
          addRandomSuffix: true,
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log('LocalClips video uploaded:', blob.pathname);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(400).json({
      error: error.message || 'Upload failed',
    });
  }
}
