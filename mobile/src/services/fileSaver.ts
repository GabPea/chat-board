/**
 * Utility per il salvataggio / download diretto di immagini e media sul dispositivo
 */
export const saveMediaToDevice = (dataUrl: string, filename?: string) => {
  if (typeof window === "undefined" || !dataUrl) return;
  try {
    const link = document.createElement("a");
    link.href = dataUrl;
    const defaultName = `sovereign_media_${Date.now()}.jpg`;
    link.download = filename || defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error("Errore durante il salvataggio del file:", e);
  }
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};

