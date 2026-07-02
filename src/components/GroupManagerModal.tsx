import { useState } from "react";
import { X, Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Group } from "../types";

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  onAddGroup: (group: Group) => void;
  onUpdateGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
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

  const handleEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setFormData(group);
  };

  const handleSave = () => {
    if (!formData.name || !formData.label) return;

    if (editingGroupId === "new") {
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        name: formData.name,
        label: formData.label,
        color: formData.color || "#cbd5e1",
        bgColor: formData.bgColor || "bg-slate-50",
        textColor: formData.textColor || "text-slate-700",
        borderColor: formData.borderColor || "border-slate-200",
      };
      onAddGroup(newGroup);
    } else if (editingGroupId) {
      onUpdateGroup(formData as Group);
    }
    
    setEditingGroupId(null);
    setFormData({});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
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
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-sans">
          
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setEditingGroupId("new");
                setFormData({
                  color: "#cbd5e1",
                  bgColor: "bg-slate-50",
                  textColor: "text-slate-700",
                  borderColor: "border-slate-200"
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              เพิ่มกลุ่มงานใหม่
            </button>
          </div>

          <div className="space-y-3">
            {editingGroupId === "new" && (
              <div className="border border-indigo-200 bg-indigo-50/30 p-4 rounded-xl flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อกลุ่มงาน (เต็ม)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="เช่น สำนักงานผู้อำนวยการ"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อย่อ (Label)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.label || ""}
                      onChange={(e) => setFormData({...formData, label: e.target.value})}
                      placeholder="เช่น ผอ."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สีหลัก (Color Hex)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.color || ""}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      placeholder="#3b82f6"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สีพื้นหลัง (bg- class)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.bgColor || ""}
                      onChange={(e) => setFormData({...formData, bgColor: e.target.value})}
                      placeholder="bg-blue-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สีข้อความ (text- class)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.textColor || ""}
                      onChange={(e) => setFormData({...formData, textColor: e.target.value})}
                      placeholder="text-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สีเส้นขอบ (border- class)</label>
                    <input
                      type="text"
                      className="w-full text-sm border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      value={formData.borderColor || ""}
                      onChange={(e) => setFormData({...formData, borderColor: e.target.value})}
                      placeholder="border-blue-200"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setEditingGroupId(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            )}

            {groups.map((group) => (
              <div key={group.id} className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col gap-3">
                {editingGroupId === group.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อกลุ่มงาน (เต็ม)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.name || ""}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อย่อ (Label)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.label || ""}
                          onChange={(e) => setFormData({...formData, label: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">สีหลัก (Color Hex)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.color || ""}
                          onChange={(e) => setFormData({...formData, color: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">สีพื้นหลัง (bg- class)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.bgColor || ""}
                          onChange={(e) => setFormData({...formData, bgColor: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">สีข้อความ (text- class)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.textColor || ""}
                          onChange={(e) => setFormData({...formData, textColor: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">สีเส้นขอบ (border- class)</label>
                        <input
                          type="text"
                          className="w-full text-sm border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50"
                          value={formData.borderColor || ""}
                          onChange={(e) => setFormData({...formData, borderColor: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setEditingGroupId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{group.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${group.bgColor} ${group.textColor} ${group.borderColor}`}>
                          {group.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex gap-3">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{backgroundColor: group.color}}></div> Color</span>
                        <span>{group.bgColor}</span>
                        <span>{group.textColor}</span>
                        <span>{group.borderColor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(group)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if(confirm("คุณต้องการลบกลุ่มงานนี้ใช่หรือไม่?")) {
                            onDeleteGroup(group.id);
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
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
