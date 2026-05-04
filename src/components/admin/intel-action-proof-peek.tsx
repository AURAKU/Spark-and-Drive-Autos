"use client";

import { UploadedFilePreview } from "@/components/uploads/uploaded-file-preview";

type Proof = {
  id: string;
  imageUrl: string;
  status: string;
  createdAt: Date;
  publicId?: string | null;
};

export function IntelActionProofPeek({ proofs }: { proofs: Proof[] }) {
  if (proofs.length === 0) {
    return <span className="text-xs text-zinc-500">No uploads</span>;
  }
  const latest = proofs[0];
  return (
    <div className="w-[min(100%,220px)] shrink-0">
      <UploadedFilePreview
        url={latest.imageUrl}
        publicId={latest.publicId}
        label="Latest proof"
        uploadedAt={latest.createdAt}
        statusLabel={latest.status}
        variant="admin"
        density="compact"
      />
    </div>
  );
}
