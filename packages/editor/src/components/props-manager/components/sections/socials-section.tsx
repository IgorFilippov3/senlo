"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { socialsSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  ToggleGroup,
  PaddingControl,
  Slider,
  Button,
  Dialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { SocialsBlock } from "@senlo/core";
import { AlignLeft, AlignCenter, AlignRight, Plus } from "lucide-react";
import { Controller } from "react-hook-form";
import { useState } from "react";
import {
  DEFAULT_SOCIALS_ALIGN,
  DEFAULT_SOCIALS_SIZE,
  DEFAULT_SOCIALS_SPACING,
  DEFAULT_SOCIALS_PADDING,
  SOCIAL_LABELS,
  SOCIAL_ICONS,
} from "./defaults/socials";
import { SocialLinksList } from "./social-links-list";

interface SocialsSectionProps {
  block: SocialsBlock;
}

export const SocialsSection = ({ block }: SocialsSectionProps) => {
  const { control, setValue, getValues } = useBlockForm({
    block,
    schema: socialsSchema,
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("facebook");

  // Получаем текущие ссылки из блока напрямую
  const currentLinks = block.data.links || [];

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const handleUpdateLink = (index: number, field: keyof any, value: string) => {
    const updatedLinks = [...currentLinks];
    updatedLinks[index] = { ...updatedLinks[index], [field]: value };
    setValue("links", updatedLinks);
  };

  const handleDeleteLink = (index: number) => {
    const updatedLinks = currentLinks.filter(
      (_: any, i: number) => i !== index,
    );
    setValue("links", updatedLinks);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedLinks = [...currentLinks];
    [updatedLinks[index - 1], updatedLinks[index]] = [
      updatedLinks[index],
      updatedLinks[index - 1],
    ];
    setValue("links", updatedLinks);
  };

  const handleMoveDown = (index: number) => {
    if (index === currentLinks.length - 1) return;
    const updatedLinks = [...currentLinks];
    [updatedLinks[index], updatedLinks[index + 1]] = [
      updatedLinks[index + 1],
      updatedLinks[index],
    ];
    setValue("links", updatedLinks);
  };

  const handleAddLink = () => {
    const newLink = {
      type: selectedNetwork as any,
      url: "",
      icon: SOCIAL_ICONS[selectedNetwork] || "",
    };
    setValue("links", [...currentLinks, newLink]);
    setIsAddModalOpen(false);
  };

  return (
    <FormSection title="Social Links Settings">
      <SocialLinksList
        links={currentLinks}
        onUpdateLink={handleUpdateLink}
        onDelete={handleDeleteLink}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
      />

      <div className="mt-4 px-4">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={16} />
          Add Social Link
        </Button>
      </div>

      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Social Link"
        description="Select a social network to add to your email."
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLink}>Add Link</Button>
          </div>
        }
      >
        <FormField label="Social Network">
          <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
            <SelectTrigger>
              <SelectValue placeholder="Select network..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOCIAL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </Dialog>

      <FormSection title="Display Settings">
        <FormField label="Alignment">
          <Controller
            name="align"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || DEFAULT_SOCIALS_ALIGN}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <Controller
          name="size"
          control={control}
          render={({ field }) => (
            <Slider
              label="Icon Size"
              unit="px"
              min={16}
              max={64}
              value={field.value || DEFAULT_SOCIALS_SIZE}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="spacing"
          control={control}
          render={({ field }) => (
            <Slider
              label="Spacing"
              unit="px"
              min={0}
              max={50}
              value={field.value || DEFAULT_SOCIALS_SPACING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value || DEFAULT_SOCIALS_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
};
