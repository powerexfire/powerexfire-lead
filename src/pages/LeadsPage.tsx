import { useEffect } from "react";
import { Flame } from "lucide-react";
import { usePowerexWorkspace } from "@/components/powerex/WorkspaceContext";
import { LeadSearchForm } from "@/components/powerex/LeadSearchForm";
import { LeadsTable } from "@/components/powerex/LeadsTable";
import { StatusPanel } from "@/components/powerex/StatusPanel";
import { LeadMetrics } from "@/components/powerex/LeadMetrics";
import { LeadDetailsDialog } from "@/components/powerex/LeadDetailsDialog";

const LeadsPage = () => {
  const {
    leads,
    queries,
    currentRole,
    statusTone,
    statusMessage,
    activeQuery,
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
    applyQuery,
    copyValue,
    exportCsv,
    loadActivity,
  } = usePowerexWorkspace();

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  return (
    <div className="grid gap-6">
      <LeadSearchForm
        industry={industry}
        location={location}
        queries={queries}
        isLoading={isLoading || isSavingLead}
        onIndustryChange={setIndustry}
        onLocationChange={setLocation}
        onSubmit={generateLeads}
        onSyncQueries={syncQueries}
        onApplyQuery={applyQuery}
      />

      <StatusPanel
        tone={statusTone}
        message={activeQuery?.query ? `${statusMessage} Active query: ${activeQuery.query}` : statusMessage}
        leadCount={leads.length}
        onRetry={undefined}
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

      <span className="sr-only" aria-live="polite">{`Signed in role: ${currentRole}`}</span>
      <Flame className="hidden" aria-hidden="true" />
    </div>
  );
};

export default LeadsPage;
