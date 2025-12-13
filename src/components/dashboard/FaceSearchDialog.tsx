'use client';

import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Member } from '@/types/tree';
import { faceRecognitionService } from '@/services/faceRecognition';
import { Loader2, Camera, Upload, Search, User, AlertCircle } from 'lucide-react';

interface FaceSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    members: Member[];
    onMatchFound: (memberId: string) => void;
}

export function FaceSearchDialog({ isOpen, onClose, members, onMatchFound }: FaceSearchDialogProps) {
    const [step, setStep] = useState<'upload' | 'scanning' | 'result' | 'error'>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [matchedMember, setMatchedMember] = useState<Member | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        setIsCameraOpen(true);
        setErrorMsg('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access denied:", err);
            setErrorMsg("Could not access camera. Please check permissions.");
            setIsCameraOpen(false);
            setStep('error');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        setPreviewUrl(url);
                        stopCamera();
                        startScan(blob);
                    }
                }, 'image/jpeg');
            }
        }
    };

    // Clean up on close
    const handleClose = () => {
        stopCamera();
        onClose();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            startScan(file);
        }
    };

    const startScan = async (queryImage: File | Blob) => {
        setStep('scanning');
        setProgress(0);
        setErrorMsg('');

        try {
            // 1. Build the Matcher (scan all existing members)
            const matcher = await faceRecognitionService.scanMembers(members, (curr, total) => {
                const percent = Math.round((curr / total) * 50); // First 50% is building DB
                setProgress(percent);
            });

            if (!matcher) {
                throw new Error("No faces found in family tree photos to compare against.");
            }

            // 2. Scan the Query Image
            setProgress(60);
            const queryDescriptor = await faceRecognitionService.getDescriptor(queryImage);
            setProgress(80);

            if (!queryDescriptor) {
                throw new Error("Could not detect a face in your uploaded photo. Please try a clearer image.");
            }

            // 3. Find Match
            const bestMatch = matcher.findBestMatch(queryDescriptor);
            setProgress(100);

            if (bestMatch.label === 'unknown') {
                setErrorMsg("No close match found in the family tree.");
                setStep('error');
            } else {
                const member = members.find(m => m.id === bestMatch.label);
                if (member) {
                    setMatchedMember(member);
                    setStep('result');
                } else {
                    setErrorMsg("Match found but member data is missing.");
                    setStep('error');
                }
            }

        } catch (err: any) {
            console.error("Face scan failed:", err);
            setErrorMsg(err.message || "Face recognition failed.");
            setStep('error');
        }
    };

    const handleConfirmMatch = () => {
        if (matchedMember) {
            onMatchFound(matchedMember.id);
            handleClose();
        }
    };

    const reset = () => {
        setStep('upload');
        setPreviewUrl(null);
        setMatchedMember(null);
        setErrorMsg('');
        stopCamera();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Search by Face">
            <div className="min-h-[300px] flex flex-col items-center justify-center p-4">

                {/* Camera View */}
                {isCameraOpen ? (
                    <div className="space-y-4 text-center w-full max-w-md animate-in fade-in zoom-in duration-300">
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover transform -scale-x-100"
                            />
                        </div>
                        <div className="flex justify-center gap-4">
                            <Button variant="outline" onClick={stopCamera}>Cancel</Button>
                            <Button onClick={capturePhoto} className="bg-indigo-600 text-white">
                                <Camera className="mr-2 h-4 w-4" /> Capture
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {step === 'upload' && (
                            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                                <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-10 h-10 text-indigo-500" />
                                </div>
                                <h3 className="text-lg font-medium">Find a Family Member</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                    Upload a photo or use your camera to find who it is in the family tree.
                                </p>

                                <div className="flex gap-4 justify-center">
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" /> Upload Photo
                                    </Button>
                                    <Button onClick={startCamera}>
                                        <Camera className="mr-2 h-4 w-4" /> Use Camera
                                    </Button>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </div>
                        )}

                        {step === 'scanning' && (
                            <div className="text-center space-y-6 animate-in fade-in duration-500 w-full max-w-sm">
                                {previewUrl && (
                                    <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-4 border-white shadow-lg relative">
                                        <img src={previewUrl} className="w-full h-full object-cover opacity-50" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-full h-1 bg-indigo-500 animate-scan" style={{ boxShadow: '0 0 10px #6366f1' }} />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-semibold text-lg animate-pulse">Scanning Faces...</h3>
                                    <p className="text-sm text-gray-500 mt-1">Comparing with tree members</p>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}

                        {step === 'result' && matchedMember && (
                            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                                <div className="relative inline-block">
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
                                            <img src={previewUrl!} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] py-1">You Uploaded</div>
                                        </div>
                                        <div className="text-2xl text-green-500 font-bold">=</div>
                                        <div className="w-24 h-24 rounded-full border-4 border-green-500 shadow-xl overflow-hidden relative">
                                            {matchedMember.photoUrl ? (
                                                <img src={matchedMember.photoUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 flex items-center justify-center"><User /></div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{matchedMember.name}</h2>
                                    <p className="text-green-600 font-medium flex items-center justify-center gap-2 mt-1">
                                        <span className="w-2 h-2 bg-green-500 rounded-full" /> Match Found
                                    </p>
                                </div>

                                <div className="flex gap-3 justify-center pt-4">
                                    <Button variant="outline" onClick={reset}>Try Again</Button>
                                    <Button onClick={handleConfirmMatch} className="bg-green-600 hover:bg-green-700 text-white">
                                        Show on Graph
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 'error' && (
                            <div className="text-center space-y-4 animate-in fade-in duration-300">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
                                    <AlertCircle size={40} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recognition Failed</h3>
                                <p className="text-gray-500 max-w-xs">{errorMsg}</p>
                                <Button onClick={reset} className="mt-4">Try Again</Button>
                            </div>
                        )}
                    </>
                )}

            </div>
        </Modal>
    );
}
