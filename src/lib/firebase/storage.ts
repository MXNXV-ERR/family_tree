import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

export const uploadPhoto = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const storageRef = ref(storage, `users/${userId}/photos/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
};
