"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Unlock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Locker } from "@/types";
import { useTranslate } from "@tolgee/react";

export default function AdminLockersPage() {
  const { t } = useTranslate();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newLocation, setNewLocation] = useState("main_floor");
  const [creating, setCreating] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchLockers = async () => {
    try {
      const data = await apiClient.get<Locker[]>("/admin/lockers");
      setLockers(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLockers();
  }, []);

  const handleCreate = async () => {
    if (!newNumber.trim()) return;
    setCreating(true);
    setError("");
    try {
      await apiClient.post("/admin/lockers", { locker_number: newNumber.trim(), location: newLocation });
      setNewNumber("");
      setNewLocation("main_floor");
      setShowForm(false);
      await fetchLockers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create locker");
    } finally {
      setCreating(false);
    }
  };

  const handleRelease = async (lockerNumber: string) => {
    setReleasing(lockerNumber);
    try {
      await apiClient.delete(`/admin/lockers/${lockerNumber}/release`);
      await fetchLockers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to release locker");
    } finally {
      setReleasing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const available = lockers.filter((l) => l.status === "available").length;
  const occupied = lockers.filter((l) => l.status === "occupied").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("lockers.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("lockers.available", { count: available })} · {t("lockers.occupied", { count: occupied })}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          {t("lockers.addLocker")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("lockers.addNewLocker")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("lockers.lockerNumberLabel")}</Label>
                <Input
                  placeholder={t("lockers.lockerNumberPlaceholder")}
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("lockers.locationLabel")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                >
                  <option value="main_floor">{t("lockers.mainFloor")}</option>
                  <option value="vip_room">{t("lockers.vipRoom")}</option>
                  <option value="entrance">{t("lockers.lockerEntrance")}</option>
                  <option value="gym">{t("lockers.gym")}</option>
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating || !newNumber.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("lockers.create")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lockers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("lockers.noLockers")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {lockers.map((locker) => (
            <Card key={locker.id} className="relative">
              <CardContent className="pt-4 pb-3 px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">{locker.locker_number}</span>
                  {locker.status === "occupied" ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{locker.location.replace(/_/g, " ")}</p>
                <Badge
                  variant="outline"
                  className={
                    locker.status === "occupied"
                      ? "border-primary/30 text-primary bg-primary/5"
                      : "border-muted text-muted-foreground"
                  }
                >
                  {locker.status === "occupied" ? t("lockers.inUse") : t("lockers.free")}
                </Badge>
                {locker.status === "occupied" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 mt-1"
                    disabled={releasing === locker.locker_number}
                    onClick={() => handleRelease(locker.locker_number)}
                  >
                    {releasing === locker.locker_number ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t("lockers.forceRelease")
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
