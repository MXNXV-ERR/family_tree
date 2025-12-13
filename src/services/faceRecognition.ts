import * as faceapi from 'face-api.js';
import { Member } from '@/types/tree';

// Configuration
const MODEL_URL = '/models';

// Singleton state
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

// Types
export interface FaceMatchResult {
    member: Member;
    distance: number;
}

export const faceRecognitionService = {
    /**
     * Initialize models (only runs once)
     */
    async loadModels() {
        if (isLoaded) return;
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            try {
                // Load only the essential models for recognition
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Face detector (heavier but accurate)
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // Landmarks
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) // Descriptors
                ]);
                isLoaded = true;
                console.log("Face API Models Loaded");
            } catch (error) {
                console.error("Failed to load Face API models:", error);
                isLoaded = false;
                loadPromise = null;
                throw error;
            }
        })();

        return loadPromise;
    },

    /**
     * Compute face descriptor for a given image URL or Blob
     */
    async getDescriptor(image: string | Blob): Promise<Float32Array | null> {
        await this.loadModels();

        // If Blob, convert to Image element
        let input: HTMLImageElement;
        if (image instanceof Blob) {
            input = await faceapi.bufferToImage(image);
        } else {
            input = await faceapi.fetchImage(image);
        }

        const detection = await faceapi.detectSingleFace(input).withFaceLandmarks().withFaceDescriptor();

        if (!detection) return null;
        return detection.descriptor;
    },

    /**
     * Helper to load image from URL/Base64
     */
    loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Important for external images
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = src;
        });
    },

    /**
     * Scan a list of members and build a LabeledFaceDescriptors matcher
     * Returns a function to find matches
     */
    async scanMembers(members: Member[], onProgress?: (current: number, total: number) => void) {
        await this.loadModels();

        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
        let processed = 0;
        const membersWithPhotos = members.filter(m => m.photoUrl);
        const total = membersWithPhotos.length;

        console.log(`Starting scan of ${total} members with photos...`);

        for (const member of membersWithPhotos) {
            if (!member.photoUrl) continue;

            try {
                // Manually load image to handle Base64 and CORS better
                const img = await this.loadImage(member.photoUrl);

                // Use a single face detector
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    console.log(`Face detected for ${member.name}`);
                    labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(member.id, [detection.descriptor]));
                } else {
                    console.warn(`No face detected in photo for ${member.name}`);
                }
            } catch (err) {
                console.warn(`Failed to process face for member ${member.name}:`, err);
            }
            processed++;
            if (onProgress) onProgress(processed, total);
        }

        if (labeledDescriptors.length === 0) {
            console.error("No valid face descriptors created from any member.");
            return null;
        }

        return new faceapi.FaceMatcher(labeledDescriptors, 0.6); // 0.6 is distance threshold
    }
};
