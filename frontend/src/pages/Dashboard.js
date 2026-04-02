import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { 
  Upload, Search, BookOpen, Eye, Share2, Edit, Copy, Archive, 
  Trash2, LogOut, Plus, Filter, Clock, MoreVertical, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const Dashboard = ({ embedded = false }) => {
  const [storybooks, setStorybooks] = useState([]);
  const [filteredStorybooks, setFilteredStorybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubtitle, setUploadSubtitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const navigate = useNavigate();
  const { logout } = useAuth();

  const loadStorybooks = useCallback(async () => {
    try {
      const data = await api.getStorybooks();
      setStorybooks(data);
    } catch (error) {
      toast.error('Failed to load storybooks');
    } finally {
      setLoading(false);
    }
  }, []);

  const filterStorybooks = useCallback(() => {
    let filtered = storybooks;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(sb => sb.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(sb => 
        sb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sb.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredStorybooks(filtered);
  }, [storybooks, searchQuery, statusFilter]);

  useEffect(() => {
    loadStorybooks();
  }, [loadStorybooks]);

  useEffect(() => {
    filterStorybooks();
  }, [filterStorybooks]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle) {
      toast.error('Please select a PDF and enter a title');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading PDF...');

    try {
      setTimeout(() => setUploadProgress('Reading page dimensions...'), 500);
      setTimeout(() => setUploadProgress('Detecting spread orientation...'), 1000);
      setTimeout(() => setUploadProgress('Rendering spreads...'), 1500);
      setTimeout(() => setUploadProgress('Building flipbook preview...'), 2000);

      const data = await api.uploadStorybook(uploadFile, uploadTitle, uploadSubtitle);
      
      toast.success('Storybook created successfully!');
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadSubtitle('');
      
      await loadStorybooks();
      
      navigate(`/admin/studio/${data.id}`);
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDelete = async (id) => {
    setDeleteConfirmId(null);
    
    try {
      await api.deleteStorybook(id);
      toast.success('Storybook deleted');
      loadStorybooks();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const copyShareLink = (slug) => {
    const link = `${window.location.origin}/view/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Share link copied!');
  };

  return (
    <div className="min-h-screen bg-magical-cream texture-paper">
      <header className="border-b border-magical-moon/30 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          {/* Mobile hamburger */}
          <Button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            variant="ghost"
            className="md:hidden text-magical-plum hover:text-magical-ink p-2"
            data-testid="mobile-menu-button"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-magical-ink rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-magical-cream" />
            </div>
            <h1 className="hidden sm:block text-xl sm:text-2xl font-serif text-magical-ink" data-testid="dashboard-heading">
              Storybook Vault
            </h1>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-magical-plum/50" />
              <Input
                type="text"
                placeholder="Search storybooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/50 border-magical-moon/20 rounded-full"
                data-testid="search-input"
              />
            </div>
          </div>

          {!embedded && (
            <div className="hidden md:flex items-center gap-2">
              <Button
                onClick={() => navigate('/admin/templates')}
                variant="ghost"
                className="text-magical-plum hover:text-magical-ink"
              >
                Templates
              </Button>
              <Button
                onClick={() => navigate('/admin/orders')}
                variant="ghost"
                className="text-magical-plum hover:text-magical-ink"
              >
                Orders
              </Button>
              <Button
                onClick={() => logout()}
                variant="ghost"
                className="text-magical-plum hover:text-magical-ink"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>

        {/* Mobile search bar */}
        <div className="md:hidden px-4 pb-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-magical-plum/50" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/50 border-magical-moon/20 rounded-full"
            />
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-serif text-magical-ink mb-6">Menu</h2>
              <Button
                onClick={() => {
                  setUploadDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start bg-magical-ink text-magical-cream hover:bg-magical-plum"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload New
              </Button>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="w-full justify-start border-magical-moon/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['all', 'draft', 'ready', 'archived'].map((status) => (
              <Button
                key={status}
                onClick={() => setStatusFilter(status)}
                variant={statusFilter === status ? 'default' : 'outline'}
                className={`whitespace-nowrap ${statusFilter === status 
                  ? 'bg-magical-ink text-magical-cream rounded-full' 
                  : 'bg-white border-magical-moon/20 text-magical-ink rounded-full hover:bg-magical-cream'
                }`}
                data-testid={`filter-${status}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>

          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-magical-rose to-magical-gold text-white font-serif tracking-widest uppercase text-xs sm:text-sm px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-glow hover:shadow-lg hover:scale-105 transition-all duration-300"
            data-testid="upload-new-button"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload New Storybook
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-soft overflow-hidden border border-magical-ink/5 aspect-[4/3] animate-pulse">
                <div className="w-full h-full bg-magical-moon/20" />
              </div>
            ))}
          </div>
        ) : filteredStorybooks.length === 0 ? (
          <div className="text-center py-20">
            <Upload className="w-16 h-16 text-magical-plum/30 mx-auto mb-4" />
            <h3 className="text-2xl font-serif text-magical-ink mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No storybooks found' : 'Upload your first storybook'}
            </h3>
            <p className="text-magical-plum mb-6">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Transform your PDFs into magical flipbook experiences'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-magical-ink text-magical-cream hover:bg-magical-plum rounded-full px-8 py-6 font-serif"
                data-testid="empty-state-upload-button"
              >
                Create First Flipbook
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredStorybooks.map((storybook) => (
              <StorybookCard
                key={storybook.id}
                storybook={storybook}
                onDelete={(id) => setDeleteConfirmId(id)}
                onShare={copyShareLink}
                onEdit={(id) => navigate(`/admin/studio/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-magical-ink">
              Delete Storybook?
            </DialogTitle>
            <DialogDescription className="font-sans text-magical-plum">
              This action cannot be undone. The storybook and all its data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setDeleteConfirmId(null)}
              variant="outline"
              className="flex-1 rounded-full border-magical-moon/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDelete(deleteConfirmId)}
              className="flex-1 bg-red-600 text-white hover:bg-red-700 rounded-full"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-magical-ink">
              Upload Storybook PDF
            </DialogTitle>
            <DialogDescription className="font-sans text-magical-plum">
              Convert your PDF into a beautiful interactive flipbook
            </DialogDescription>
          </DialogHeader>

          {uploading ? (
            <div className="py-12 text-center">
              <div className="inline-block w-12 h-12 border-4 border-magical-plum border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-magical-ink font-serif text-lg">{uploadProgress}</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-sans font-medium text-magical-ink mb-2">
                  Storybook Title *
                </label>
                <Input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Luna's Magical Adventure"
                  className="bg-white/50 border-magical-ink/10 focus:border-magical-rose rounded-lg"
                  data-testid="upload-title-input"
                />
              </div>

              <div>
                <label className="block text-sm font-sans font-medium text-magical-ink mb-2">
                  Subtitle (Optional)
                </label>
                <Input
                  type="text"
                  value={uploadSubtitle}
                  onChange={(e) => setUploadSubtitle(e.target.value)}
                  placeholder="e.g., A bedtime story"
                  className="bg-white/50 border-magical-ink/10 focus:border-magical-rose rounded-lg"
                  data-testid="upload-subtitle-input"
                />
              </div>

              <div>
                <label className="block text-sm font-sans font-medium text-magical-ink mb-2">
                  PDF File *
                </label>
                <div className="border-2 border-dashed border-magical-moon rounded-xl p-8 text-center hover:border-magical-rose transition-colors cursor-pointer"
                  onClick={() => document.getElementById('pdf-upload').click()}
                  data-testid="file-drop-zone"
                >
                  {uploadFile ? (
                    <div>
                      <BookOpen className="w-12 h-12 text-magical-gold mx-auto mb-2" />
                      <p className="text-magical-ink font-sans">{uploadFile.name}</p>
                      <p className="text-xs text-magical-plum mt-1">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-magical-plum/50 mx-auto mb-2" />
                      <p className="text-magical-ink font-sans">
                        Drop your PDF here or click to browse
                      </p>
                      <p className="text-xs text-magical-plum mt-1">
                        Supports high-resolution illustrated PDFs
                      </p>
                    </div>
                  )}
                </div>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                  data-testid="pdf-file-input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setUploadDialogOpen(false)}
                  variant="outline"
                  className="flex-1 rounded-full border-magical-moon/20"
                  data-testid="upload-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadFile || !uploadTitle}
                  className="flex-1 bg-magical-ink text-magical-cream hover:bg-magical-plum rounded-full"
                  data-testid="upload-submit-button"
                >
                  Upload & Convert
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StorybookCard = ({ storybook, onDelete, onShare, onEdit }) => {
  const coverUrl = getImageUrl(storybook.coverImageUrl);
  
  return (
    <div className="group relative bg-white rounded-xl shadow-soft hover:shadow-floating transition-all duration-500 overflow-hidden border border-magical-ink/5 aspect-[4/3] cursor-pointer"
      onClick={() => onEdit(storybook.id)}
      data-testid={`storybook-card-${storybook.id}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
      />

      <div className="absolute top-3 right-3 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="bg-white/90 hover:bg-white rounded-full w-8 h-8 p-0"
              data-testid={`storybook-menu-${storybook.id}`}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(storybook.id); }} data-testid={`edit-${storybook.id}`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(storybook.slug); }} data-testid={`share-${storybook.id}`}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(storybook.id); }} className="text-red-600" data-testid={`delete-${storybook.id}`}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute top-3 left-3 z-20">
        <span className={`px-3 py-1 rounded-full text-xs font-sans ${
          storybook.status === 'ready' 
            ? 'bg-magical-teal/90 text-white' 
            : 'bg-magical-moon/90 text-magical-ink'
        }`}>
          {storybook.status}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 z-20 text-white">
        <h3 className="font-serif text-xl mb-1 line-clamp-1" data-testid={`storybook-title-${storybook.id}`}>
          {storybook.title}
        </h3>
        {storybook.subtitle && (
          <p className="text-sm text-white/80 line-clamp-1 mb-2">
            {storybook.subtitle}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-white/70">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {storybook.viewCount} views
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {storybook.spreadCount} spreads
          </span>
          {storybook.passwordProtected && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Protected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
