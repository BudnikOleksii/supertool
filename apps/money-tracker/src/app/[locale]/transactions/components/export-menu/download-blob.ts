export interface DownloadBlobOptions {
  content: string;
  fileName: string;
  mimeType: string;
}

export const downloadBlob = ({ content, fileName, mimeType }: DownloadBlobOptions): void => {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};
