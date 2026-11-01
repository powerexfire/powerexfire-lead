import { useEffect } from "react";
import { usePowerexWorkspace } from "@/components/powerex/WorkspaceContext";
import { LeadSearchForm } from "@/components/powerex/LeadSearchForm";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { StatusPanel } from "@/components/powerex/StatusPanel";
import { LeadMetrics } from "@/components/powerex/LeadMetrics";
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
    syncQueries,
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
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <LeadSearchForm
        industry={industry}
        location={location}
        isLoading={isLoading || isSavingLead}
        onIndustryChange={setIndustry}
        onLocationChange={setLocation}
        onSubmit={generateLeads}
        onSyncQueries={syncQueries}
      />

      <StatusPanel
        tone={statusTone}
        message={statusMessage}
        leadCount={leads.length}
        onRetry={retryLastAction}
      />

      <LeadMetrics leads={leads} />

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
