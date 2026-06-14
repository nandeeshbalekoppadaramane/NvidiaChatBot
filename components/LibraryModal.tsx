import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Upload, Book, Library, Loader2, FileText, Check, ChevronDown, ChevronRight } from "lucide-react";
// Since pdfjs-dist is loaded dynamically in ChatInterface, we'll do the same here for text extraction

interface Collection {
  id: string;
  name: string;
  documentCount: number;
  documents: string[];
}

export function LibraryModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingTo, setUploadingTo] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<{collectionId: string, documentName: string} | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        setCollections(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name: newCollectionName.trim() })
      });
      if (res.ok) {
        setNewCollectionName("");
        await fetchCollections();
      } else {
        const errorText = await res.text();
        alert(`Failed to create collection: ${errorText}`);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      setCollections(collections.filter(c => c.id !== id));
      showToast("Collection deleted successfully", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete collection", "error");
    } finally {
      setCollectionToDelete(null);
    }
  };

  const executeDeleteDocument = async () => {
    if (!documentToDelete) return;
    const { collectionId, documentName } = documentToDelete;
    
    try {
      const res = await fetch(`/api/collections/${collectionId}/documents?name=${encodeURIComponent(documentName)}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        showToast("Document deleted successfully");
        await fetchCollections();
      } else {
        const err = await res.text();
        showToast(`Failed to delete document: ${err}`, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("An error occurred.", "error");
    } finally {
      setDocumentToDelete(null);
    }
  };

  const handleFileUpload = async (collectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingTo(collectionId);
    
    try {
      let totalChunks = 0;
      
      for (let fIndex = 0; fIndex < files.length; fIndex++) {
        const file = files[fIndex];
        let extractedText = "";
        
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            extractedText += pageText + "\n\n";
          }
        } else if (file.name.endsWith(".docx")) {
          const arrayBuffer = await file.arrayBuffer();
          const mammoth = (await import('mammoth')).default || (await import('mammoth'));
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
        } else {
          extractedText = await file.text();
        }

        if (extractedText.trim().length === 0) {
          console.warn(`Could not extract text from ${file.name}.`);
          continue;
        }

        const res = await fetch(`/api/collections/${collectionId}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: extractedText,
            documentName: file.name
          })
        });

        if (res.ok) {
          const data = await res.json();
          totalChunks += data.chunksProcessed;
        } else {
          const errText = await res.text();
          throw new Error(`Failed to upload ${file.name}: ${errText}`);
        }
      }

      showToast(`Successfully indexed ${totalChunks} chunks across ${files.length} file(s)!`, "success");
      await fetchCollections();

    } catch (err: any) {
      console.error("Upload error:", err);
      showToast(err.message || "Error processing file.", "error");
    } finally {
      setUploadingTo(null);
      e.target.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col h-[80vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#76B900]/10">
              <Library className="text-[#76B900]" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Knowledge Library</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage your RAG Collections and Second Brain.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Create New */}
        <div className="p-6 border-b border-white/5 flex gap-3">
          <input 
            type="text" 
            placeholder="e.g. Direct Tax Bare Acts" 
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#76B900]/50 transition-colors"
          />
          <button 
            onClick={handleCreate}
            disabled={isCreating || !newCollectionName.trim()}
            className="bg-[#76B900] hover:bg-[#8dd417] disabled:opacity-50 text-black font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2 text-sm"
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create Collection
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-[#76B900]" size={32} />
            </div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Book size={48} className="mb-4 opacity-20" />
              <p>Your library is empty.</p>
              <p className="text-sm">Create a collection above to start uploading PDFs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {collections.map(col => (
                <div key={col.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between group hover:border-white/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-black/50 rounded-lg shrink-0">
                      <Book className="text-[#76B900]" size={20} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <h3 className="font-bold text-white text-lg">{col.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <button 
                          onClick={() => toggleExpand(col.id)}
                          className="text-xs bg-[#76B900]/10 hover:bg-[#76B900]/20 transition-colors text-[#76B900] px-2 py-0.5 rounded flex items-center gap-1 w-fit cursor-pointer"
                        >
                          {expandedCollections.has(col.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <FileText size={10} />
                          {col.documentCount} Document{col.documentCount !== 1 ? 's' : ''}
                        </button>
                      </div>
                      
                      {/* Documents List */}
                      {expandedCollections.has(col.id) && col.documents && col.documents.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2">
                          {col.documents.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-black/30 rounded-md px-3 py-1.5 border border-white/5 group/doc">
                              <span className="text-xs text-gray-300 truncate pr-4" title={doc}>{doc}</span>
                              <button 
                                onClick={() => setDocumentToDelete({ collectionId: col.id, documentName: doc })}
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover/doc:opacity-100 transition-opacity"
                                title="Delete Document"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 shrink-0 ml-4">
                    <input 
                      type="file" 
                      id={`file-${col.id}`}
                      className="hidden" 
                      accept=".txt,.pdf,.docx"
                      multiple
                      onChange={(e) => handleFileUpload(col.id, e)}
                    />
                    <label 
                      htmlFor={`file-${col.id}`}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        uploadingTo === col.id 
                          ? 'bg-[#76B900]/20 text-[#76B900]' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {uploadingTo === col.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploadingTo === col.id ? 'Indexing...' : 'Upload PDF'}
                    </label>
                    <button 
                      onClick={() => setCollectionToDelete(col.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Collection"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Toast Notification */}
        {toast && (
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 ${toast.type === 'success' ? 'bg-[#76B900] text-black' : 'bg-red-500 text-white'}`}>
            {toast.type === 'success' ? <Check size={18} /> : <X size={18} />}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        )}

        {/* Delete Confirmation Overlay */}
        {collectionToDelete && (
          <div className="absolute inset-0 bg-[#18181b]/80 backdrop-blur-sm z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[#242427] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4 mx-auto">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Delete Knowledge Base?</h3>
              <p className="text-sm text-gray-400 text-center mb-6">
                This will permanently delete the collection <span className="text-white font-medium">"{collections.find(c => c.id === collectionToDelete)?.name}"</span> and all of its indexed documents. This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCollectionToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(collectionToDelete)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Document Delete Confirmation Overlay */}
        {documentToDelete && (
          <div className="absolute inset-0 bg-[#18181b]/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[#242427] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4 mx-auto">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Delete Document?</h3>
              <p className="text-sm text-gray-400 text-center mb-6">
                This will permanently delete the document <span className="text-white font-medium">"{documentToDelete.documentName}"</span> and all of its indexed vector chunks. This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDocumentToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeleteDocument}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
