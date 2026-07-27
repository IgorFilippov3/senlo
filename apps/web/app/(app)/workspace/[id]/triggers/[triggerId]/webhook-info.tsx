"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@senlo/ui";
import { Webhook, Copy, Check, Info } from "lucide-react";

interface WebhookInfoProps {
  campaignId: number;
  sampleData?: Record<string, unknown> | null;
  hasLocales?: boolean;
}

export function WebhookInfo({
  campaignId,
  sampleData,
  hasLocales,
}: WebhookInfoProps) {
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/triggered`);
  }, []);

  const sampleJson = JSON.stringify(
    {
      id: campaignId,
      to: "customer@example.com",
      subject: "this value will override template subject",
      data: sampleData || {
        user_name: "Alex",
        order_id: "#12345",
      },
      ...(hasLocales ? { locale: "en" } : {}),
    },
    null,
    2,
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-blue-100 bg-blue-50/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-blue-900">
          <Webhook size={18} className="text-blue-600" />
          API Integration
        </h3>
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-700 border-blue-200"
        >
          Webhook
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-blue-800/60 tracking-wider">
            Webhook URL
          </label>
          <div className="flex items-center gap-2 p-2.5 bg-white border border-blue-100 rounded-lg shadow-sm">
            <code className="text-sm text-blue-900 flex-1 truncate">
              {webhookUrl || "Loading..."}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 hover:bg-blue-50 text-blue-600"
              onClick={() => webhookUrl && copyToClipboard(webhookUrl)}
              disabled={!webhookUrl}
            >
              {copied ? (
                <Check size={20} strokeWidth={2.5} />
              ) : (
                <Copy size={20} strokeWidth={2.5} />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-blue-800/60 tracking-wider">
            Sample Payload (POST) - Updated
          </label>
          <div className="relative group">
            <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed shadow-inner">
              {sampleJson}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-3 right-3 h-8 px-2 bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all opacity-0 group-hover:opacity-100"
              onClick={() => copyToClipboard(sampleJson)}
            >
              <Copy size={16} strokeWidth={2.5} className="mr-1.5" />
              Copy
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 bg-white/50 border border-blue-100 rounded-lg">
          <Info size={16} className="text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800 leading-relaxed space-y-1">
            <p>
              Include your API Key in the{" "}
              <code>Authorization: Bearer YOUR_KEY</code> header.
            </p>
            <p>
              The <code>data</code> object properties will be used to replace
              merge tags in both the subject and body.
            </p>
            <p>
              The <code>subject</code> field is optional and overrides the
              template subject.
            </p>
            {hasLocales && (
              <p>
                Use the <code>locale</code> field to trigger a specific language
                variant of this email.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
