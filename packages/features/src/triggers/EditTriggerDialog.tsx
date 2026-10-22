"use client";

import React, { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  JsonEditor,
} from "@senlo/ui";
import { Save, X, Plus, Trash2 } from "lucide-react";
import type { Campaign, Project, EmailTemplate } from "@senlo/core";
import { FormErrorBanner } from "../shared/FormErrorBanner";

/** "de", "pt-br", "zh-hant": a language, optionally a region or script. */
const LOCALE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

export interface EditTriggerDialogProps {
  campaign: Campaign;
  project: Project;
  templates: EmailTemplate[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  isSaving?: boolean;
  /** A save failure from the server, shown above the footer. */
  error?: string | null;
}

export function EditTriggerDialog({
  campaign,
  project,
  templates,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  error,
}: EditTriggerDialogProps) {
  const [formData, setFormData] = useState({
    name: campaign.name,
    description: campaign.description || "",
    fromName: campaign.fromName || "",
    fromEmail: campaign.fromEmail || "",
    variablesSchema: JSON.stringify(campaign.variablesSchema || {}, null, 2),
    localeTemplates: campaign.localeTemplates || {},
  });
  const [newLocale, setNewLocale] = useState("");
  const [localeError, setLocaleError] = useState<string | null>(null);

  const addLocale = () => {
    const code = newLocale.trim().toLowerCase();
    if (!LOCALE_CODE.test(code)) {
      setLocaleError("Use a locale code such as de, es or pt-br.");
      return;
    }
    if (code in formData.localeTemplates) {
      setLocaleError(`"${code}" is already in the list.`);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      localeTemplates: { ...prev.localeTemplates, [code]: campaign.templateId },
    }));
    setNewLocale("");
    setLocaleError(null);
  };

  const handleSaveClick = async () => {
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "localeTemplates") {
        data.append(key, JSON.stringify(value));
      } else {
        data.append(key, value as string);
      }
    });
    await onSave(data);
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
          <Button onClick={handleSaveClick} disabled={isSaving}>
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
                <div className="flex items-center gap-2">
                  <Input
                    value={newLocale}
                    onChange={(e) => {
                      setNewLocale(e.target.value);
                      setLocaleError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLocale();
                      }
                    }}
                    placeholder="de"
                    aria-label="Locale code"
                    className="w-24 h-8"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={addLocale}
                    disabled={!newLocale.trim()}
                  >
                    <Plus size={14} className="mr-1" />
                    Add Locale
                  </Button>
                </div>
              </div>
              {localeError && (
                <p className="-mt-2 mb-3 text-xs text-red-600">{localeError}</p>
              )}

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

        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}
