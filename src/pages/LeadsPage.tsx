import { useEffect } from "react";
import { usePowerexWorkspace } from "@/components/powerex/WorkspaceContext";
import { LeadsHeader } from "@/components/powerex/LeadsHeader";
import { StatusBar } from "@/components/powerex/StatusBar";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { LeadDetailsDialog } from "@/components/powerex/LeadDetailsDialog";

const LeadsPage = () => {
  const {
    leads,
    statusTone,
    statusMessage,
    isLoading,
    isSavingLead,
    searchTerm,
    statusFilter,
    filteredLeads,
    selectedLead,
    industry,
    location,
    setIndustry,
    setLocation,
    setSearchTerm,
    setStatusFilter,
    setSelectedLead,
    generateLeads,
    syncLeads,
    saveLeadDetails,
    copyValue,
    exportCsv,
    retryLastAction,
  } = usePowerexWorkspace();

  useEffect(() => {
    document.title = "Powerex Fire · Leads";
  }, []);

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <LeadsHeader
        industry={industry}
        location={location}
        leads={leads}
        isLoading={isLoading || isSavingLead}
        onIndustryChange={setIndustry}
        onLocationChange={setLocation}
        onSubmit={generateLeads}
      />

      <StatusBar tone={statusTone} message={statusMessage} onRetry={retryLastAction} />

      <LeadsTable
        leads={filteredLeads}
        totalLeads={leads.length}
        isLoading={isLoading || isSavingLead}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSyncLeads={syncLeads}
        onExport={exportCsv}
        onCopy={copyValue}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onEditLead={setSelectedLead}
      />

      <LeadDetailsDialog
        lead={selectedLead}
        open={Boolean(selectedLead)}
        isSaving={isSavingLead}
        onOpenChange={(open) => { if (!open) setSelectedLead(null); }}
        onSave={saveLeadDetails}
      />
    </div>
  );
};

export default LeadsPage;
