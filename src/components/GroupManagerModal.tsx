import { useState } from "react";
import { X, Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Group } from "../types";
import { DEFAULT_GROUP_COLOR, getGroupBadgeStyle, getGroupPalette, withDerivedGroupColors } from "../utils/groupColors";

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onAddGroup: (group: Group) => void | Promise<void>;
  onUpdateGroup: (group: Group) => void | Promise<void>;
  onDeleteGroup: (groupId: string) => void | Promise<void>;
}

export default function GroupManagerModal({
  isOpen,
  onClose,
  groups,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
}: GroupManagerModalProps) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({});

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingGroupId(null);
    setFormData({});
  };

  const startNewGroup = () => {
    setEditingGroupId("new");
    setFormData({ color: DEFAULT_GROUP_COLOR });
  };

  const handleEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setFormData(group);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.label) return;

    if (editingGroupId === "new") {
      const newGroup = withDerivedGroupColors({
        id: `group-${Date.now()}`,
        name: formData.name,
        label: formData.label,
        color: formData.color || DEFAULT_GROUP_COLOR,
      });
      await onAddGroup(newGroup);
    } else if (editingGroupId) {
      await onUpdateGroup(withDerivedGroupColors(formData as Group));
    }

    resetForm();
  };

  const renderGroupForm = (surfaceClassName: string) => {
    const colorValue = formData.color || DEFAULT_GROUP_COLOR;
    const palette = getGroupPalette(colorValue);
    const previewName = formData.name || "ชื่อกลุ่มงาน";
    const previewLabel = formData.label || "Label";

    return (
      <div className={`${surfaceClassName} p-4 rounded-xl flex flex-col gap-4`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อกลุ่มงาน (เต็ม)</label>
            <input
              type="text"
              className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น สำนักงานผู้อำนวยการ"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อย่อ (Label)</label>
            <input
              type="text"
              className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              value={formData.label || ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="เช่น ผอ."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">สีหลัก</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer"
                value={palette.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                aria-label="เลือกสีหลัก"
              />
              <input
                type="text"
                className="min-w-0 flex-1 text-sm font-mono uppercase border border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                value={colorValue}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                onBlur={() => setFormData({ ...formData, color: palette.color })}
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ตัวอย่างสี</label>
            <div className="min-h-10 rounded-xl border px-3 py-2 flex flex-wrap items-center gap-2 bg-white" style={{ borderColor: palette.borderColor }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.color }} />
              <span className="text-sm font-bold text-slate-800">{previewName}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                style={getGroupBadgeStyle({ color: palette.color })}
              >
                {previewLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!formData.name || !formData.label}
          >
            บันทึก
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Tag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-sans">จัดการกลุ่มงาน/กองสังกัด</h2>
              <p className="text-xs text-slate-500 font-sans">เพิ่ม ลบ หรือแก้ไขกลุ่มงานสำหรับผู้ดูแลระบบ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 font-sans">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={startNewGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              เพิ่มกลุ่มงานใหม่
            </button>
          </div>

          <div className="space-y-3">
            {editingGroupId === "new" && renderGroupForm("border border-indigo-200 bg-indigo-50/30")}

            {groups.map((group) => {
              const badgeStyle = getGroupBadgeStyle(group);

              return (
                <div key={group.id} className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col gap-3">
                  {editingGroupId === group.id ? (
                    renderGroupForm("border border-indigo-100 bg-slate-50")
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border" style={badgeStyle}>
                            {group.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getGroupPalette(group.color).color }} />
                            {getGroupPalette(group.color).color.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(group)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("คุณต้องการลบกลุ่มงานนี้ใช่หรือไม่?")) {
                              void onDeleteGroup(group.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
