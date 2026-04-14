"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { deletePartCategoryAction, type PartsAdminFormState } from "@/actions/parts-admin";

type Props = { categoryId: string };

export function CategoryRemoveForm({ categoryId }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(deletePartCategoryAction, null as PartsAdminFormState);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Category removed or deactivated");
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (
          !confirm(
            "Remove this category? If parts still reference it, it will be deactivated instead of deleted.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={categoryId} />
      <button type="submit" className="text-xs text-red-300 hover:underline">
        Remove
      </button>
    </form>
  );
}
