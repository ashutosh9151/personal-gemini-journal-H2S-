import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Archive, ArrowUpRight, BookOpen, Check, ChevronDown, CircleAlert, CirclePlus, Clock3,
  Command, Compass, Feather, KeyRound, Lightbulb, Lock, LogOut, Menu, MoreHorizontal,
  Pencil, Plus, RefreshCw, Save, Send, Settings as SettingsIcon, ShieldCheck, Sparkles,
  Tag, Trash2, X, Zap,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetJournalQueryKey, getHealthCheckQueryKey,
  getListInsightsQueryKey, getListJournalsQueryKey, useCreateInsight, useCreateJournal,
  useDeleteInsight, useDeleteJournal, useGetDashboardSummary, useGetJournal, useHealthCheck,
  useListInsights, useListJournals, useSendJournalMessage, useUpdateInsight, useUpdateJournal,
} from '@workspace/api-client-react';
import type { Insight, Journal } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  authRequest, clearFirebaseSession, getFirebaseConfig, getFirebaseIdToken,
  signInWithFirebasePassword, subscribeFirebaseAuth,
} from '@/lib/auth';

const queryClient = new QueryClient();
const cx = (...items: Array<string | false | undefined>) => items.filter(Boolean).join(' ');
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value)) : '—';
const formatTime = (value?: string) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const initials = (email: string) => email ? email.slice(0, 2).toUpperCase() : 'ME';

function Skeleton({ className = '' }: { className?: string }) {
  return <div data-testid="loading-skeleton" className={cx('animate-pulse-soft rounded-lg bg-muted', className)} />;
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof BookOpen; title: string; body: string; action?: ReactNode }) {
  return <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/45 px-6 text-center animate-rise">
    <div className="mb-4 rounded-full bg-secondary p-3 text-primary"><Icon size={22} strokeWidth={1.7} /></div>
    <h3 className="serif text-2xl text-foreground">{title}</h3>
    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

function ErrorState({ onRetry, message = 'Something interrupted the quiet.' }: { onRetry?: () => void; message?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive" data-testid="status-error">
    <CircleAlert size={18} /><span className="flex-1">{message}</span>
    {onRetry && <button data-testid="button-retry" onClick={onRetry} className="font-semibold underline underline-offset-4">Try again</button>}
  </div>;
}

function Logo() {
  return <Link href="/" data-testid="link-home" className="group flex items-center gap-3">
    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground transition-transform duration-300 group-hover:-rotate-6"><Feather size={18} strokeWidth={2.1} /><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-secondary" /></span>
    <span><span className="block font-semibold tracking-[-.03em]">Gemini Journal</span><span className="mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">private / by you</span></span>
  </Link>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const email = localStorage.getItem('personal-gemini-journal.email') ?? '';
  const navItems = [
    { href: '/', label: 'Workspace', icon: Compass },
    { href: '/insights', label: 'Insight cards', icon: Lightbulb },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];
  const signOut = () => { void clearFirebaseSession(); setLocation('/login'); };
  return <div className="journal-grain flex min-h-[100dvh] bg-background">
    <aside className={cx('fixed inset-y-0 left-0 z-30 flex w-[268px] -translate-x-full flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 md:static md:translate-x-0', mobileNav && 'translate-x-0')}>
      <div className="flex items-center justify-between"><Logo /><button data-testid="button-close-navigation" className="rounded-lg p-1 text-sidebar-foreground/60 md:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="mt-12 flex-1">
        <p className="mono mb-3 px-3 text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Your space</p>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors', location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/66 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}><Icon size={17} strokeWidth={location === href ? 2.1 : 1.7} /><span>{label}</span>{location === href && <ArrowUpRight size={14} className="ml-auto text-accent" />}</Link>)}
        </nav>
        <div className="mt-10 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-4">
          <div className="mb-3 flex items-center gap-2 text-accent"><Lock size={14} /><span className="mono text-[10px] uppercase tracking-[.15em]">Private by default</span></div>
          <p className="text-xs leading-5 text-sidebar-foreground/60">Your thoughts stay yours. Gemini only sees what you choose to send into a journal.</p>
        </div>
      </div>
      <div className="border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div data-testid="avatar-user" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-xs text-secondary-foreground">{initials(email)}</div>
          <div className="min-w-0 flex-1"><p data-testid="text-user-email" className="truncate text-xs font-medium">{email || 'Personal space'}</p><p className="mono text-[9px] uppercase tracking-wider text-sidebar-foreground/45">signed in</p></div>
          <button data-testid="button-sign-out" onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
    {mobileNav && <button data-testid="button-navigation-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} className="fixed inset-0 z-20 bg-primary/25 md:hidden" />}
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-10">
        <button data-testid="button-open-navigation" className="rounded-lg p-2 text-muted-foreground md:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" /> A quiet place to think</div>
        <div className="ml-auto flex items-center gap-3"><span className="mono hidden text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:inline">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}</span><div className="h-5 w-px bg-border" /><Link href="/settings" data-testid="link-header-settings" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><SettingsIcon size={17} /></Link></div>
      </header>
      <div className="mx-auto max-w-[1420px] px-5 py-8 md:px-10 md:py-10">{children}</div>
    </main>
  </div>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(getFirebaseIdToken()));
  useEffect(() => subscribeFirebaseAuth(user => { setSignedIn(Boolean(user)); setReady(true); }), []);
  if (!ready) return <div className="grid min-h-[100dvh] place-items-center bg-background"><RefreshCw size={18} className="animate-spin text-accent-foreground" /></div>;
  return signedIn ? <AppShell>{children}</AppShell> : <Login />;
}

function Login() {
  const [, setLocation] = useLocation();
  const config = getFirebaseConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!config.configured) return;
    setBusy(true);
    try { await signInWithFirebasePassword(email, password); localStorage.setItem('personal-gemini-journal.email', email); setLocation('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  };
  return <div className="journal-grain grid min-h-[100dvh] bg-background lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-28 top-24 h-80 w-80 rounded-full border border-accent/25" /><div className="absolute -right-10 top-40 h-56 w-56 rounded-full border border-accent/20" />
      <Logo />
      <div className="relative max-w-lg animate-rise"><p className="mono mb-5 text-[10px] uppercase tracking-[.2em] text-accent">A private practice</p><h1 className="serif text-7xl leading-[.88] tracking-[-.03em]">Make room<br /><em>for the thought.</em></h1><p className="mt-7 max-w-sm text-sm leading-6 text-primary-foreground/65">A personal notebook with a patient second voice. Keep the fragments, follow the threads, notice what keeps returning.</p></div>
      <p className="mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/40">Personal Gemini Journal · 01</p>
    </section>
    <section className="flex items-center justify-center p-6 md:p-12"><div className="w-full max-w-[410px] animate-rise">
      <div className="mb-10 lg:hidden"><Logo /></div>
      <div className="mb-8"><span className="mb-4 inline-flex rounded-full bg-secondary px-3 py-1 mono text-[10px] uppercase tracking-[.14em] text-secondary-foreground"><ShieldCheck size={12} className="mr-2" /> encrypted entry</span><h2 className="serif text-5xl leading-none">Welcome back.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your journals are waiting where you left them.</p></div>
      {!config.configured ? <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5" data-testid="status-firebase-unconfigured"><div className="mb-3 flex items-center gap-2 font-semibold"><KeyRound size={17} className="text-accent-foreground" /> Firebase needs a key</div><p className="text-sm leading-6 text-muted-foreground">This deployment has not been connected to Firebase yet. Add <code className="mono text-xs">VITE_FIREBASE_API_KEY</code> and <code className="mono text-xs">VITE_FIREBASE_PROJECT_ID</code> to enable sign-in.</p><Link href="/settings" data-testid="link-firebase-settings" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">View deployment settings <ArrowUpRight size={14} /></Link></div> :
      <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-semibold">Email</span><input data-testid="input-login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm transition-shadow placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-accent/45" /></label><label className="block"><span className="mb-2 block text-xs font-semibold">Password</span><input data-testid="input-login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your Firebase password" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm transition-shadow placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-accent/45" /></label>{error && <ErrorState message={error} />}<button data-testid="button-login-submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy ? <><RefreshCw size={16} className="animate-spin" /> Checking your key…</> : <>Enter your journal <ArrowUpRight size={16} /></>}</button><p className="pt-2 text-center text-xs leading-5 text-muted-foreground">Sign-in is handled by Firebase. Your password never reaches this journal.</p></form>}
      <div className="mt-10 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Lock size={13} /> Private notebook</span><span className="mono">v1.0 / personal</span></div>
    </div></section>
  </div>;
}

function Workspace() {
  const token = getFirebaseIdToken();
  const journalsQuery = useListJournals({ query: { enabled: Boolean(token), queryKey: getListJournalsQueryKey() }, request: authRequest() });
  const summaryQuery = useGetDashboardSummary({ query: { enabled: Boolean(token), queryKey: getGetDashboardSummaryQueryKey() }, request: authRequest() });
  const journals = useMemo(() => journalsQuery.data ?? [], [journalsQuery.data]);
  const summary = summaryQuery.data;
  const [selectedId, setSelectedId] = useState('');
  const [newJournalOpen, setNewJournalOpen] = useState(false);
  useEffect(() => { if (!selectedId && (summary?.latestJournal?.id || journals[0]?.id)) setSelectedId(summary?.latestJournal?.id || journals[0]?.id || ''); }, [selectedId, summary?.latestJournal?.id, journals]);
  const journalQuery = useGetJournal(selectedId, { query: { enabled: Boolean(token && selectedId), queryKey: getGetJournalQueryKey(selectedId) }, request: authRequest() });
  const journal = journalQuery.data ?? journals.find(item => item.id === selectedId) ?? summary?.latestJournal;
  return <div className="animate-rise">
    <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-muted-foreground">Your workspace</p><h1 className="serif text-5xl leading-none tracking-[-.02em] md:text-6xl">Good to see you.</h1><p className="mt-3 text-sm text-muted-foreground">Pick up a thread, or start one while it is still warm.</p></div><button data-testid="button-new-journal" onClick={() => setNewJournalOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus size={17} /> New journal</button></div>
    {!token ? <SetupNotice /> : journalsQuery.isLoading || summaryQuery.isLoading ? <WorkspaceSkeleton /> : journalsQuery.isError || summaryQuery.isError ? <ErrorState onRetry={() => { journalsQuery.refetch(); summaryQuery.refetch(); }} message="Your journals could not be opened right now." /> : <><SummaryStrip summary={summary} /><div className="mt-8 grid gap-7 xl:grid-cols-[minmax(210px,270px)_minmax(0,1fr)]"><JournalList journals={journals} selectedId={selectedId} onSelect={setSelectedId} onNew={() => setNewJournalOpen(true)} /><Conversation journal={journal} onDeleted={() => setSelectedId('')} /></div></>}
    {newJournalOpen && <JournalDialog onClose={() => setNewJournalOpen(false)} />}
  </div>;
}

function SetupNotice() {
  return <div className="relative overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground md:p-10"><div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-accent/25" /><div className="relative max-w-2xl"><span className="mono text-[10px] uppercase tracking-[.2em] text-accent">One small step</span><h2 className="serif mt-3 text-4xl">Connect your private space.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/70">Sign in with Firebase to load your journals. Until then, nothing is requested from the journal API and nothing is stored here.</p><Link href="/login" data-testid="link-workspace-login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5">Go to sign in <ArrowUpRight size={16} /></Link></div></div>;
}

function WorkspaceSkeleton() {
  return <><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><div className="mt-8 grid gap-7 xl:grid-cols-[270px_1fr]"><Skeleton className="h-[470px]" /><Skeleton className="h-[470px]" /></div></>;
}

function SummaryStrip({ summary }: { summary?: { journalCount: number; messageCount: number; openInsightCount: number } }) {
  const items = [{ label: 'Journals', value: summary?.journalCount ?? 0, icon: BookOpen }, { label: 'Thoughts exchanged', value: summary?.messageCount ?? 0, icon: Zap }, { label: 'Open insights', value: summary?.openInsightCount ?? 0, icon: Lightbulb }];
  return <div className="grid gap-3 sm:grid-cols-3">{items.map(({ label, value, icon: Icon }, index) => <div key={label} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('rounded-2xl border bg-card px-5 py-4 shadow-journal', index === 2 && 'border-accent/50 bg-accent/10')}><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon size={15} className={index === 2 ? 'text-accent-foreground' : 'text-muted-foreground'} /></div><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>)}</div>;
}

function JournalList({ journals, selectedId, onSelect, onNew }: { journals: Journal[]; selectedId: string; onSelect: (id: string) => void; onNew: () => void }) {
  return <section className="min-w-0"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Your journals</h2><p className="text-xs text-muted-foreground">Private conversations</p></div><button data-testid="button-add-journal" onClick={onNew} aria-label="Add journal" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><CirclePlus size={17} /></button></div>{journals.length === 0 ? <EmptyState icon={BookOpen} title="A blank first page" body="Give this space a name. It can hold a single question or a season of thoughts." action={<button data-testid="button-empty-new-journal" onClick={onNew} className="text-sm font-semibold text-primary underline underline-offset-4">Start a journal</button>} /> : <div className="space-y-2">{journals.map((item, index) => <button key={item.id} data-testid={`button-journal-${item.id}`} onClick={() => onSelect(item.id)} className={cx('group w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5', selectedId === item.id ? 'border-primary/35 bg-card shadow-journal' : 'border-transparent bg-muted/45 hover:border-border hover:bg-card')}><div className="flex items-start gap-3"><span className={cx('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg mono text-[10px]', selectedId === item.id ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground')}>{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 size={11} /> {item.messages.length} {item.messages.length === 1 ? 'entry' : 'entries'} · {formatDate(item.updatedAt)}</span></span>{selectedId === item.id && <span className="mt-1 h-2 w-2 rounded-full bg-accent" />}</div></button>)}</div>}</section>;
}

function Conversation({ journal, onDeleted }: { journal?: Journal | null; onDeleted: () => void }) {
  const [draft, setDraft] = useState('');
  const [capture, setCapture] = useState<{ title: string; body: string } | null>(null);
  const [showJournalMenu, setShowJournalMenu] = useState(false);
  const queryClient = useQueryClient();
  const send = useSendJournalMessage({ request: authRequest() });
  const update = useUpdateJournal({ request: authRequest() });
  const remove = useDeleteJournal({ request: authRequest() });
  const createInsight = useCreateInsight({ request: authRequest() });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!journal || !draft.trim() || send.isPending) return; const text = draft.trim(); setDraft(''); send.mutate({ journalId: journal.id, data: { text } }, { onSuccess: result => { queryClient.setQueryData(getGetJournalQueryKey(journal.id), result); queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } }); };
  const rename = () => { if (!journal) return; const title = window.prompt('Rename this journal', journal.title); if (title?.trim()) update.mutate({ journalId: journal.id, data: { title: title.trim() } }, { onSuccess: result => { queryClient.setQueryData(getGetJournalQueryKey(journal.id), result); queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() }); } }); };
  const deleteCurrent = () => { if (!journal || !window.confirm(`Delete “${journal.title}”? This cannot be undone.`)) return; remove.mutate({ journalId: journal.id }, { onSuccess: () => { queryClient.removeQueries({ queryKey: getGetJournalQueryKey(journal.id) }); queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onDeleted(); } }); };
  if (!journal) return <EmptyState icon={Feather} title="Choose a thread" body="Your conversation will unfold here. Nothing is shared until you write it." />;
  return <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-3xl border border-card-border bg-card shadow-journal"><header className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:px-7"><div className="min-w-0"><p className="mono mb-1 text-[9px] uppercase tracking-[.16em] text-muted-foreground">Active journal</p><h2 data-testid="text-active-journal-title" className="truncate font-semibold">{journal.title}</h2></div><div className="relative"><button data-testid="button-journal-menu" onClick={() => setShowJournalMenu(value => !value)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><MoreHorizontal size={18} /></button>{showJournalMenu && <div className="absolute right-0 top-11 z-10 w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"><button data-testid="button-rename-journal" onClick={() => { setShowJournalMenu(false); rename(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><Pencil size={14} /> Rename</button><button data-testid="button-delete-journal" onClick={() => { setShowJournalMenu(false); deleteCurrent(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Delete journal</button></div>}</div></header><div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-9">{journal.messages.length === 0 ? <div className="flex min-h-[310px] flex-col items-center justify-center text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Sparkles size={21} /></div><h3 className="serif text-3xl">Begin anywhere.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Tell Gemini what is on your mind. A question, a contradiction, a tiny observation.</p></div> : journal.messages.map(message => <div key={message.id} data-testid={`message-${message.id}`} className={cx('flex animate-rise', message.role === 'user' ? 'justify-end' : 'justify-start')}><div className={cx('max-w-[88%] md:max-w-[72%]', message.role === 'user' ? 'items-end' : 'items-start')}><div className={cx('rounded-2xl px-4 py-3 text-sm leading-6', message.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground')}><p className="whitespace-pre-wrap">{message.text}</p></div><div className={cx('mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground', message.role === 'user' && 'justify-end')}><span>{message.role === 'user' ? 'You' : 'Gemini'}</span><span>·</span><span>{formatTime(message.createdAt)}</span>{message.role === 'model' && <button data-testid={`button-capture-insight-${message.id}`} onClick={() => setCapture({ title: 'A thought worth keeping', body: message.text })} className="ml-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"><Lightbulb size={11} /> Keep this</button>}</div></div></div>)}</div><form onSubmit={submit} className="border-t border-border/70 bg-muted/20 p-4 md:p-5"><div className="flex items-end gap-3 rounded-2xl border border-input bg-card p-2 pl-4 transition-shadow focus-within:ring-2 focus-within:ring-accent/40"><textarea data-testid="input-journal-message" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }} rows={2} placeholder="Write what is present…" className="max-h-32 min-h-[46px] flex-1 resize-none bg-transparent py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground/60" /><button data-testid="button-send-message" disabled={!draft.trim() || send.isPending} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40">{send.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}</button></div><p className="mt-2 px-1 text-[10px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p></form>{capture && <InsightDialog initial={capture} onClose={() => setCapture(null)} onSaved={() => setCapture(null)} createInsight={createInsight} />}</section>;
}

function JournalDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();
  const create = useCreateJournal({ request: authRequest() });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; create.mutate({ data: { title: title.trim() } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onClose(); } }); };
  return <Modal title="Name a new journal" onClose={onClose}><p className="mb-5 text-sm leading-6 text-muted-foreground">Give this thread a name you will recognize later. You can change it anytime.</p><form onSubmit={submit}><input autoFocus data-testid="input-new-journal-title" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The shape of this season" className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm focus:ring-2 focus:ring-accent/40" /><div className="mt-5 flex justify-end gap-2"><button type="button" data-testid="button-cancel-new-journal" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button><button data-testid="button-create-journal" disabled={!title.trim() || create.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{create.isPending ? 'Making space…' : 'Create journal'}</button></div></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-5 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md animate-rise rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="mb-2 flex items-center justify-between"><h2 className="serif text-3xl">{title}</h2><button data-testid="button-close-modal" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div>{children}</div></div>;
}

function InsightDialog({ initial, onClose, onSaved, createInsight }: { initial?: { title: string; body: string; tags?: string[]; status?: 'open' | 'done' }; onClose: () => void; onSaved: () => void; createInsight: ReturnType<typeof useCreateInsight> }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '');
  const submit = (event: FormEvent) => { event.preventDefault(); createInsight.mutate({ data: { title: title.trim(), body: body.trim(), tags: tags.split(',').map(item => item.trim()).filter(Boolean).slice(0, 8), status: initial?.status ?? 'open' } }, { onSuccess: onSaved }); };
  return <Modal title="Keep an insight" onClose={onClose}><form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-semibold">Title</span><input data-testid="input-insight-title" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">The thought</span><textarea data-testid="input-insight-body" required maxLength={2000} rows={5} value={body} onChange={e => setBody(e.target.value)} className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Tags <span className="font-normal text-muted-foreground">(comma separated)</span></span><input data-testid="input-insight-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="work, pattern, remember" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label><div className="flex justify-end gap-2 pt-1"><button type="button" data-testid="button-cancel-insight" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">Not now</button><button data-testid="button-save-insight" disabled={createInsight.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{createInsight.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save card</button></div></form></Modal>;
}

function Insights() {
  const token = getFirebaseIdToken();
  const queryClient = useQueryClient();
  const query = useListInsights({ query: { enabled: Boolean(token), queryKey: getListInsightsQueryKey() }, request: authRequest() });
  const update = useUpdateInsight({ request: authRequest() });
  const remove = useDeleteInsight({ request: authRequest() });
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [editing, setEditing] = useState<Insight | null>(null);
  const insights = useMemo(() => query.data ?? [], [query.data]);
  const tags = useMemo(() => Array.from(new Set(insights.flatMap(item => item.tags))).sort(), [insights]);
  const filtered = insights.filter(item => (filter === 'all' || item.status === filter) && (tagFilter === 'all' || item.tags.includes(tagFilter)));
  const toggleStatus = (item: Insight) => update.mutate({ insightId: item.id, data: { status: item.status === 'open' ? 'done' : 'open' } }, {
    onSuccess: result => {
      queryClient.setQueryData(getListInsightsQueryKey(), (old: Insight[] | undefined) => old?.map(entry => entry.id === result.id ? result : entry));
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    },
  });
  const deleteItem = (item: Insight) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    remove.mutate({ insightId: item.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() }) });
  };
  return <div className="animate-rise">
    <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-muted-foreground">A growing collection</p><h1 className="serif text-5xl leading-none md:text-6xl">Insight cards.</h1><p className="mt-3 text-sm text-muted-foreground">Small truths you decided not to lose.</p></div>
      <div className="flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-xs text-secondary-foreground"><Lightbulb size={15} /> {insights.filter(item => item.status === 'open').length} open to revisit</div>
    </div>
    {!token ? <SetupNotice /> : query.isLoading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div> : query.isError ? <ErrorState onRetry={() => query.refetch()} message="Your insight cards could not be loaded." /> : <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-1">{(['all', 'open', 'done'] as const).map(item => <button key={item} data-testid={`button-filter-${item}`} onClick={() => setFilter(item)} className={cx('rounded-lg px-3 py-1.5 text-xs capitalize transition-colors', filter === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{item}</button>)}</div>
        {tags.length > 0 && <div className="flex items-center gap-2"><Tag size={14} className="ml-2 text-muted-foreground" /><select data-testid="select-insight-tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="all">All tags</option>{tags.map(tag => <option value={tag} key={tag}>{tag}</option>)}</select></div>}
      </div>
      {filtered.length === 0 ? <EmptyState icon={Lightbulb} title={insights.length ? 'Nothing in this view' : 'No saved insights yet'} body={insights.length ? 'Try another status or tag. The right thought may be one filter away.' : 'When a line from a conversation stays with you, keep it here.'} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item, index) => <InsightCard key={item.id} item={item} index={index} onToggle={() => toggleStatus(item)} onEdit={() => setEditing(item)} onDelete={() => deleteItem(item)} />)}</div>}
    </>}
    {editing && <EditInsightDialog item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() }); }} updateInsight={update} />}
  </div>;
}

function InsightCard({ item, index, onToggle, onEdit, onDelete }: { item: Insight; index: number; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return <article data-testid={`card-insight-${item.id}`} className={cx('group relative flex min-h-[230px] flex-col rounded-2xl border bg-card p-5 shadow-journal transition-all duration-300 hover:-translate-y-1', item.status === 'done' ? 'border-border/70 opacity-75' : index % 3 === 1 ? 'border-accent/35' : 'border-card-border')}><div className="mb-5 flex items-start justify-between"><span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mono text-[9px] uppercase tracking-[.12em]', item.status === 'done' ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground')}><span className={cx('h-1.5 w-1.5 rounded-full', item.status === 'done' ? 'bg-muted-foreground' : 'bg-secondary-foreground')} />{item.status}</span><div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"><button data-testid={`button-edit-insight-${item.id}`} onClick={onEdit} aria-label="Edit insight" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Pencil size={14} /></button><button data-testid={`button-delete-insight-${item.id}`} onClick={onDelete} aria-label="Delete insight" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button></div></div><h2 className={cx('serif text-2xl leading-tight', item.status === 'done' && 'line-through decoration-accent/70')}>{item.title}</h2><p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-muted-foreground">{item.body}</p><div className="mt-5 flex items-end justify-between gap-3"><div className="flex flex-wrap gap-1.5">{item.tags.map(tag => <span key={tag} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">#{tag}</span>)}</div><button data-testid={`button-toggle-insight-${item.id}`} onClick={onToggle} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">{item.status === 'done' ? 'Reopen' : 'Done'}</button></div></article>;
}

function EditInsightDialog({ item, onClose, onSaved, updateInsight }: { item: Insight; onClose: () => void; onSaved: () => void; updateInsight: ReturnType<typeof useUpdateInsight> }) {
  const [title, setTitle] = useState(item.title); const [body, setBody] = useState(item.body); const [tags, setTags] = useState(item.tags.join(', '));
  const submit = (event: FormEvent) => { event.preventDefault(); updateInsight.mutate({ insightId: item.id, data: { title: title.trim(), body: body.trim(), tags: tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 8) } }, { onSuccess: onSaved }); };
  return <Modal title="Edit insight" onClose={onClose}><form onSubmit={submit} className="space-y-4"><input data-testid="input-edit-insight-title" required value={title} onChange={e => setTitle(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /><textarea data-testid="input-edit-insight-body" required rows={5} value={body} onChange={e => setBody(e.target.value)} className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6" /><input data-testid="input-edit-insight-tags" value={tags} onChange={e => setTags(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /><div className="flex justify-end gap-2"><button type="button" data-testid="button-cancel-edit-insight" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button><button data-testid="button-update-insight" disabled={updateInsight.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Update card</button></div></form></Modal>;
}

function Settings() {
  const config = getFirebaseConfig();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const [privateMode, setPrivateMode] = useState(() => localStorage.getItem('personal-gemini-journal.private-mode') !== 'off');
  const [email] = useState(() => localStorage.getItem('personal-gemini-journal.email') ?? '');
  const togglePrivate = (value: boolean) => { setPrivateMode(value); localStorage.setItem('personal-gemini-journal.private-mode', value ? 'on' : 'off'); };
  return <div className="animate-rise max-w-4xl"><div className="mb-9"><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-muted-foreground">The edges of your space</p><h1 className="serif text-5xl leading-none md:text-6xl">Settings.</h1><p className="mt-3 text-sm text-muted-foreground">A few details about your account and this deployment.</p></div><div className="space-y-5"><SettingsSection icon={ShieldCheck} title="Account"><div className="flex items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground">{initials(email)}</div><div><p data-testid="settings-user-email" className="font-semibold">{email || 'No Firebase session'}</p><p className="text-xs text-muted-foreground">Authenticated through Firebase Identity Platform</p></div><span data-testid="status-authenticated" className="ml-auto rounded-full bg-secondary px-2.5 py-1 mono text-[9px] uppercase tracking-wider text-secondary-foreground">{getFirebaseIdToken() ? 'active' : 'signed out'}</span></div></SettingsSection><SettingsSection icon={Lock} title="Privacy"><div className="flex items-center justify-between gap-5"><div><p className="text-sm font-semibold">Private mode</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">Keep this journal behind your Firebase session. Gemini receives only the message you actively send.</p></div><button data-testid="button-toggle-private-mode" onClick={() => togglePrivate(!privateMode)} className={cx('relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors', privateMode ? 'bg-primary' : 'bg-muted')} aria-label="Toggle private mode"><span className={cx('block h-5 w-5 rounded-full bg-card shadow-sm transition-transform', privateMode && 'translate-x-5')} /></button></div></SettingsSection><SettingsSection icon={Command} title="Deployment readiness"><div className="divide-y divide-border/70">{[{ label: 'Firebase configuration', detail: config.configured ? `Project ${config.projectId}` : 'Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID', ok: config.configured }, { label: 'Journal API', detail: health.isLoading ? 'Checking connection…' : health.data?.status || (health.isError ? 'Unavailable' : 'Ready'), ok: !health.isError && !health.isLoading }, { label: 'Authorization', detail: getFirebaseIdToken() ? 'Bearer token present for API requests' : 'Sign in to authorize API requests', ok: Boolean(getFirebaseIdToken()) }].map(item => <div key={item.label} className="flex items-center gap-4 py-4"><span className={cx('grid h-7 w-7 place-items-center rounded-full', item.ok ? 'bg-secondary text-secondary-foreground' : 'bg-accent/20 text-accent-foreground')}>{item.ok ? <Check size={15} /> : <CircleAlert size={15} />}</span><div className="flex-1"><p className="text-sm font-semibold">{item.label}</p><p data-testid={`status-${item.label.toLowerCase().replaceAll(' ', '-')}`} className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p></div></div>)}</div></SettingsSection><div className="rounded-2xl border border-accent/35 bg-accent/10 p-5"><div className="flex gap-3"><Archive size={18} className="mt-0.5 shrink-0 text-accent-foreground" /><div><h2 className="font-semibold">A note on trust</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">This interface never fabricates a signed-in state. If Firebase is not configured or your token is absent, the journal API stays untouched and the setup state remains visible.</p></div></div></div></div></div>;
}

function SettingsSection({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-card-border bg-card p-5 shadow-journal md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-primary"><Icon size={16} /></span><h2 className="font-semibold">{title}</h2></div>{children}</section>;
}

function NotFound() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-6 text-center"><div><div className="serif text-8xl text-primary">404</div><p className="mt-3 text-sm text-muted-foreground">This page is not in the journal.</p><Link href="/" data-testid="link-not-found-home" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">Return to your space <ArrowUpRight size={15} /></Link></div></div>;
}

function Router() {
  return <Switch><Route path="/login" component={Login} /><Route path="/"><AuthGate><Workspace /></AuthGate></Route><Route path="/insights"><AuthGate><Insights /></AuthGate></Route><Route path="/settings"><AppShell><Settings /></AppShell></Route><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ErrorBoundary><Router /></ErrorBoundary><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;