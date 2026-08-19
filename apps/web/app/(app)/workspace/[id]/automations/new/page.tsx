"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createWorkflow } from "../actions";
import { Button, Input, Label, Card } from "@senlo/ui";
import { logger } from "apps/web/lib/logger";

export default function NewAutomationPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const result = await createWorkflow(projectId, name);
      if (result.success) {
        router.push(`/workspace/${projectId}/automations/${result.data.id}`);
      } else {
        // Handle error
        logger.error("Failed to create workflow", { error: result.error });
      }
    } catch (error) {
      logger.error("Error creating workflow", { error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <div className="max-w-xl mx-auto py-12">
        <Card className="p-10 border-gray-200 shadow-xl rounded-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Create Automation
          </h1>
          <p className="text-gray-500 mb-8 text-sm">
            Give your automation a name to get started building your flow.
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="font-semibold text-xs uppercase tracking-wider text-gray-400"
              >
                Automation Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. Welcome Series"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-gray-200 h-11 text-base focus:ring-2 focus:ring-blue-500/20"
                autoFocus
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 font-semibold text-gray-600"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                disabled={loading || !name.trim()}
              >
                {loading ? "Creating..." : "Create Automation"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
