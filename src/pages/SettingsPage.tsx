import { useEffect } from "react";
import { SettingsPanel } from "@/components/powerex/SettingsPanel";
import { usePowerexWorkspace } from "@/components/powerex/WorkspaceContext";

const SettingsPage = () => {
  const {
    session,
    users,
    activity,
    currentRole,
    isLoading,
    isUserLoading,
    assignRole,
    loadActivity,
    loadUsers,
  } = usePowerexWorkspace();

  useEffect(() => {
    void loadActivity();
    void loadUsers(true);
  }, [loadActivity, loadUsers]);

  return (
    <div className="grid gap-6">
      <SettingsPanel
        userEmail={session.user.email}
        userId={session.user.id}
        currentRole={currentRole}
        users={users}
        activity={activity}
        onRefreshActivity={loadActivity}
        onRefreshUsers={() => loadUsers(false)}
        onRoleChange={assignRole}
        isLoading={isLoading}
        isUserLoading={isUserLoading}
      />
    </div>
  );
};

export default SettingsPage;
