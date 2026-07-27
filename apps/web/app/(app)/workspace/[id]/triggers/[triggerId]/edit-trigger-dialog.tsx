"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  JsonEditor,
} from "@senlo/ui";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { Campaign, Project, EmailTemplate } from "@senlo/core";
import { updateCampaignAction } from "../actions";
import { logger } from "apps/web/lib/logger";
import { useTemplates } from "apps/web/hooks/use-templates";

interface EditTriggerDialogProps {
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTriggerDialog({
  campaign,
  project,
  template,
  isOpen,
  onClose,
}: EditTriggerDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { templates } = useTemplates({
    filters: { projectId: project.id },
    enabled: isOpen,
  });

  const [formData, setFormData] = useState({
    name: campaign.name,
    description: campaign.description || "",
    fromName: campaign.fromName || "",
    fromEmail: campaign.fromEmail || "",
    variablesSchema: JSON.stringify(campaign.variablesSchema || {}, null, 2),
    localeTemplates: campaign.localeTemplates || {},
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "localeTemplates") {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value as string);
        }
      });
      const result = await updateCampaignAction(campaign.id, data);
      if ("success" in result && result.success) {
        onClose();
      } else if ("error" in result && result.error) {
        const fieldErrors = result.error.fieldErrors;
        let errorMessage = "Validation failed";

        if (fieldErrors) {
          if ("name" in fieldErrors && fieldErrors.name?.[0]) {
            errorMessage = fieldErrors.name[0];
          } else if ("fromEmail" in fieldErrors && fieldErrors.fromEmail?.[0]) {
            errorMessage = fieldErrors.fromEmail[0];
          } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
            errorMessage = fieldErrors.general[0];
          }
        }

        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      logger.error("Failed to update campaign from info card", {
        campaignId: campaign.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Configuration"
      className="max-w-2xl"
      disableAnimation={true}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            <X size={16} className="mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
            <Save size={16} className="ml-2" />
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        <FormField label="Internal Name" required>
          <Input
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="From Name">
            <Input
              value={formData.fromName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fromName: e.target.value }))
              }
              placeholder="e.g. Igor from Senlo"
            />
          </FormField>
          <FormField label="From Email">
            <Input
              value={formData.fromEmail}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  fromEmail: e.target.value,
                }))
              }
              placeholder="e.g. hello@senlo.io"
            />
          </FormField>
        </div>

        <FormField label="Description">
          <Textarea
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            rows={2}
          />
        </FormField>

        {campaign.type === "TRIGGERED" && (
          <>
            <FormField
              label="Sample JSON Data (Variables)"
              hint="Defines variables available in the editor"
            >
              <JsonEditor
                value={formData.variablesSchema}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, variablesSchema: val }))
                }
                height="180px"
              />
            </FormField>

            <div className="pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">
                    Language Variants
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Map specific templates to languages
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    const locale = prompt(
                      "Enter locale code (e.g. ru, es, de):",
                    );
                    if (locale) {
                      setFormData((prev) => ({
                        ...prev,
                        localeTemplates: {
                          ...prev.localeTemplates,
                          [locale.toLowerCase()]: campaign.templateId,
                        },
                      }));
                    }
                  }}
                >
                  <Plus size={14} className="mr-1" />
                  Add Locale
                </Button>
              </div>

              <div className="space-y-3">
                {Object.entries(formData.localeTemplates).map(
                  ([locale, templateId]) => (
                    <div
                      key={locale}
                      className="grid grid-cols-12 gap-3 items-end"
                    >
                      <div className="col-span-3">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 mb-1 block">
                          Locale
                        </label>
                        <div className="px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-md text-sm font-bold uppercase">
                          {locale}
                        </div>
                      </div>
                      <div className="col-span-7">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 mb-1 block">
                          Template
                        </label>
                        <select
                          className="w-full h-9 px-3 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={templateId}
                          onChange={(e) => {
                            const newId = parseInt(e.target.value);
                            setFormData((prev) => ({
                              ...prev,
                              localeTemplates: {
                                ...prev.localeTemplates,
                                [locale]: newId,
                              },
                            }));
                          }}
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.locale})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="text-zinc-400 hover:text-red-600 h-9 w-full"
                          onClick={() => {
                            const newLocales = {
                              ...formData.localeTemplates,
                            };
                            delete newLocales[locale];
                            setFormData((prev) => ({
                              ...prev,
                              localeTemplates: newLocales,
                            }));
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ),
                )}
                {Object.keys(formData.localeTemplates).length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-zinc-100 rounded-xl text-zinc-400 text-xs">
                    No language variants added yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
