import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadStatuses } from "@/lib/lead-pipeline";
import type { Lead, LeadStatus } from "./types";

type LeadDetailsDialogProps = {
  lead: Lead | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (lead: Lead, changes: { status: LeadStatus; notes: string; followUpDate: string | null }) => void;
};

export function LeadDetailsDialog({ lead, open, isSaving, onOpenChange, onSave }: LeadDetailsDialogProps) {
  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  useEffect(() => {
    setStatus(lead?.status ?? "new");
    setNotes(lead?.notes ?? "");
    setFollowUpDate(lead?.followUpDate ?? "");
  }, [lead]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="pr-8">Update lead</DialogTitle>
          <DialogDescription>{lead?.name} · {lead?.location || lead?.address || "Location not listed"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label htmlFor="lead-status">Pipeline status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
              <SelectTrigger id="lead-status" aria-label="Pipeline status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {leadStatuses.map((value) => <SelectItem key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lead-follow-up">Follow-up date</Label>
            <input
              id="lead-follow-up"
              type="date"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lead-notes">Sales notes</Label>
            <Textarea
              id="lead-notes"
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Record the latest conversation or next step"
              rows={5}
              aria-describedby="lead-notes-count"
            />
            <p id="lead-notes-count" className="text-right text-xs text-muted-foreground">{notes.length}/2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="steel" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="button" variant="fire" disabled={isSaving} onClick={() => lead && onSave(lead, { status, notes: notes.trim(), followUpDate: followUpDate || null })}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}