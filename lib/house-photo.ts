// User photos stay in this browser, scoped to the selected household.
function openPhotos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("energihem-house-photos", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readHousePhoto(
  householdId: string,
): Promise<Blob | null> {
  const db = await openPhotos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const request = tx.objectStore("photos").get(householdId);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function saveHousePhoto(householdId: string, photo: Blob) {
  const db = await openPhotos();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put(photo, householdId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// A bundled default follows the app between preview domains; IndexedDB cannot.
// The original photo still has to be supplied as a repository asset before enabling this manifest.
export async function readBundledHousePhoto(
  householdId: string,
): Promise<string | null> {
  try {
    const response = await fetch("/house-photo.json", { cache: "no-store" });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== "object" ||
      !("householdId" in value) ||
      !("url" in value)
    )
      return null;
    if (
      value.householdId !== householdId ||
      typeof value.url !== "string" ||
      !/^\/[A-Za-z0-9_/-]+\.(jpg|jpeg|png|webp)$/.test(value.url)
    )
      return null;
    return value.url;
  } catch {
    return null;
  }
}
