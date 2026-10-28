// Local domain adapter for the installed Toolkit primitive; shared shims are outside this task.
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@agent-native/toolkit/ui/alert-dialog";

export function CsvDiscardDialog({ open, onConfirm, onCancel }: {
  open: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={value => { if (!value) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved drafts?</AlertDialogTitle>
          <AlertDialogDescription>
            Discard unsaved corrections and manual proposal draft to continue the requested operation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep drafts</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard drafts and continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
