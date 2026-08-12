"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 p-2 bg-gray-50/80 rounded-t-xl">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('bold') ? 'bg-[#c39254]/20 text-[#7f561e]' : 'text-slate-500 hover:bg-gray-200'
        }`}
        title="Negrita"
      >
        <Bold size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('italic') ? 'bg-[#c39254]/20 text-[#7f561e]' : 'text-slate-500 hover:bg-gray-200'
        }`}
        title="Cursiva"
      >
        <Italic size={16} strokeWidth={2.5} />
      </button>
      
      <div className="w-px h-5 bg-gray-300 mx-1"></div>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('bulletList') ? 'bg-[#c39254]/20 text-[#7f561e]' : 'text-slate-500 hover:bg-gray-200'
        }`}
        title="Viñetas"
      >
        <List size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-md transition-colors ${
          editor.isActive('orderedList') ? 'bg-[#c39254]/20 text-[#7f561e]' : 'text-slate-500 hover:bg-gray-200'
        }`}
        title="Lista numerada"
      >
        <ListOrdered size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export function RichTextEditor({ value, onChange, placeholder = "Escriba aquí..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Retorna el HTML generado
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // Clases de Tailwind aplicadas directamente a la zona de escritura
        class: 'focus:outline-none min-h-[120px] p-4 text-sm text-slate-700',
      },
    },
  });

  return (
    <div className="border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#c39254]/20 focus-within:border-[#c39254] transition-all bg-white overflow-hidden shadow-sm">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}