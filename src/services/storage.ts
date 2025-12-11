
import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadPhoto = async (userId: string, file: File): Promise<string> => {
    // Create a reference to 'images/{userId}/{fileName}'
    // Using timestamp to avoid name collisions
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `images/${userId}/${fileName}`);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading photo:", error);
        throw error;
    }
};
