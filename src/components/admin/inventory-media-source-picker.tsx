"use client";

import { Camera, FolderOpen, Video } from "lucide-react";
import { useRef, useState } from "react";

import { InventoryImageCropDialog } from "@/components/admin/inventory-image-crop-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIDEO_ACCEPT =
  "video/*,video/mp4,video/webm,video/quicktime,video/3gpp,video/mpeg,.mp4,.webm,.mov,.m4v,.avi,.mkv,.3gp,.mpeg,.mpg";

type ImagePickerProps = {
  kind: "image";
  disabled?: boolean;
  multiple?: boolean;
  onFilesReady: (files: File[]) => void | Promise<void>;
  uploadLabel?: string;
};

type VideoPickerProps = {
  kind: "video";
  disabled?: boolean;
  /** Allow selecting multiple walkthrough clips at once. */
  multiple?: boolean;
  onFilesReady: (files: File[]) => void | Promise<void>;
  uploadLabel?: string;
};

type Props = ImagePickerProps | VideoPickerProps;

export function InventoryMediaSourcePicker(props: Props) {
  const { disabled, uploadLabel } = props;
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("photo.jpg");
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);

  const [videoPreview, setVideoPreview] = useState<{ file: File; url: string } | null>(null);

  function resetDeviceInput() {
    if (deviceInputRef.current) deviceInputRef.current.value = "";
  }

  function resetCameraInput() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function openNextImageCrop(files: File[], index: number) {
    const file = files[index];
    if (!file) {
      resetDeviceInput();
      resetCameraInput();
      return;
    }
    setPendingImageFiles(files.slice(index + 1));
    setCropFileName(file.name);
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
  }

  function onDeviceChange(fileList: FileList | null) {
    if (!fileList?.length || disabled) return;
    const files = Array.from(fileList);
    if (props.kind === "video") {
      resetDeviceInput();
      if (props.multiple && files.length > 1) {
        void props.onFilesReady(files);
        return;
      }
      const file = files[0];
      if (!file) return;
      setVideoPreview({ file, url: URL.createObjectURL(file) });
      return;
    }
    openNextImageCrop(files, 0);
  }

  function onCameraChange(fileList: FileList | null) {
    if (!fileList?.length || disabled) return;
    const files = Array.from(fileList);
    if (props.kind === "video") {
      resetCameraInput();
      if (props.multiple && files.length > 1) {
        void props.onFilesReady(files);
        return;
      }
      const file = files[0];
      if (!file) return;
      setVideoPreview({ file, url: URL.createObjectURL(file) });
      return;
    }
    openNextImageCrop(files, 0);
  }

  function closeCrop() {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);
    setPendingImageFiles([]);
    resetDeviceInput();
    resetCameraInput();
  }

  async function onCropConfirm(file: File) {
    if (props.kind !== "image") return;
    await props.onFilesReady([file]);
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    if (pendingImageFiles.length > 0) {
      const [next, ...rest] = pendingImageFiles;
      setPendingImageFiles(rest);
      setCropFileName(next.name);
      setCropSrc(URL.createObjectURL(next));
      setCropOpen(true);
      return;
    }
    setCropSrc(null);
    setCropOpen(false);
    resetDeviceInput();
    resetCameraInput();
  }

  async function confirmVideo() {
    if (props.kind !== "video" || !videoPreview) return;
    await props.onFilesReady([videoPreview.file]);
    URL.revokeObjectURL(videoPreview.url);
    setVideoPreview(null);
    resetDeviceInput();
    resetCameraInput();
  }

  function cancelVideoPreview() {
    if (videoPreview?.url.startsWith("blob:")) URL.revokeObjectURL(videoPreview.url);
    setVideoPreview(null);
    resetDeviceInput();
    resetCameraInput();
  }

  const label = uploadLabel ?? (props.kind === "image" ? "Add photos" : "Add video");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-white/15 text-zinc-200 hover:bg-white/5"
          disabled={disabled}
          onClick={() => deviceInputRef.current?.click()}
        >
          <FolderOpen className="size-3.5" />
          {label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-white/15 text-zinc-200 hover:bg-white/5"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          {props.kind === "image" ? <Camera className="size-3.5" /> : <Video className="size-3.5" />}
          {props.kind === "image" ? "Take photo" : "Record video"}
        </Button>
      </div>

      <input
        ref={deviceInputRef}
        type="file"
        accept={props.kind === "image" ? "image/*" : VIDEO_ACCEPT}
        multiple={
          props.kind === "image"
            ? props.multiple !== false
            : Boolean(props.multiple)
        }
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onDeviceChange(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={props.kind === "image" ? "image/*" : VIDEO_ACCEPT}
        capture={props.kind === "image" ? "environment" : "environment"}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onCameraChange(e.target.files)}
      />

      {props.kind === "image" ? (
        <InventoryImageCropDialog
          open={cropOpen}
          imageSrc={cropSrc}
          fileName={cropFileName}
          onOpenChange={(open) => {
            if (!open) closeCrop();
            else setCropOpen(true);
          }}
          onConfirm={onCropConfirm}
        />
      ) : null}

      {props.kind === "video" ? (
        <Dialog open={Boolean(videoPreview)} onOpenChange={(open) => !open && cancelVideoPreview()}>
          <DialogContent className="max-w-xl border-white/10 bg-zinc-950 text-white" showCloseButton>
            <DialogHeader>
              <DialogTitle>Preview video</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Review the clip before uploading. The full video is stored — no forced crop or trim.
              </DialogDescription>
            </DialogHeader>
            {videoPreview ? (
              <video
                src={videoPreview.url}
                controls
                playsInline
                className="max-h-[50vh] w-full rounded-xl bg-black"
              />
            ) : null}
            <DialogFooter className="border-white/10 bg-zinc-900/50">
              <Button type="button" variant="outline" onClick={cancelVideoPreview}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--brand)] text-black hover:opacity-90"
                onClick={() => void confirmVideo()}
              >
                Upload video
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
