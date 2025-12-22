import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  User, 
  AtSign, 
  Wallet, 
  Gift, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

type OnboardingStep = 'persona' | 'fio' | 'wallet' | 'welcome';

// Domain rules:
// - Humans can only use @qripto or @knyt
// - Agents can only use @aigent (but agents are added via AddPersonaModal, not onboarding)
const HUMAN_DOMAINS = ['qripto', 'knyt'] as const;
type HumanDomain = typeof HUMAN_DOMAINS[number];

interface OnboardingState {
  displayName: string;
  fioHandle: string;
  fioAvailable: boolean | null;
  fioChecking: boolean;
  identityType: 'human' | 'ai_agent';
  selectedDomain: HumanDomain;
  walletGenerating: boolean;
  walletGenerated: boolean;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>('persona');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  
  const [state, setState] = useState<OnboardingState>({
    displayName: '',
    fioHandle: '',
    fioAvailable: null,
    fioChecking: false,
    identityType: 'human',
    selectedDomain: 'qripto',
    walletGenerating: false,
    walletGenerated: false,
  });

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);
      
      // Pre-fill display name from email
      if (!state.displayName) {
        const emailName = user.email?.split('@')[0] || '';
        setState(prev => ({ ...prev, displayName: emailName }));
      }
    };
    checkAuth();
  }, [navigate]);

  const steps: { key: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { key: 'persona', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { key: 'fio', label: 'Handle', icon: <AtSign className="h-4 w-4" /> },
    { key: 'wallet', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
    { key: 'welcome', label: 'Welcome', icon: <Gift className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Check FIO handle availability - directly via Supabase
  const checkFioAvailability = async (handle: string, domain: HumanDomain = state.selectedDomain) => {
    if (!handle || handle.length < 3) {
      setState(prev => ({ ...prev, fioAvailable: null, fioChecking: false }));
      return;
    }

    setState(prev => ({ ...prev, fioChecking: true, fioAvailable: null }));
    
    try {
      const fullHandle = `${handle}@${domain}`;
      
      // Check directly in Supabase - no need for API proxy
      const { data: existingPersona, error } = await supabase
        .from('persona')
        .select('id')
        .eq('fio_handle', fullHandle)
        .maybeSingle();

      if (error) {
        console.error('Supabase check error:', error);
        // On error, allow progression
        setState(prev => ({ 
          ...prev, 
          fioChecking: false, 
          fioAvailable: true 
        }));
        return;
      }

      // Available if no existing persona found
      const available = !existingPersona;
      
      setState(prev => ({ 
        ...prev, 
        fioAvailable: available,
        fioChecking: false 
      }));
    } catch (err: any) {
      console.error('FIO check error:', err);
      // On error, allow the user to proceed
      setState(prev => ({ 
        ...prev, 
        fioChecking: false, 
        fioAvailable: true
      }));
    }
  };

  // Debounced FIO check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.fioHandle) {
        checkFioAvailability(state.fioHandle);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.fioHandle]);

  const handleNext = async () => {
    setError('');
    setLoading(true);

    try {
      if (step === 'persona') {
        if (!state.displayName.trim()) {
          setError('Please enter a display name');
          setLoading(false);
          return;
        }
        setStep('fio');
      } else if (step === 'fio') {
        if (!state.fioHandle.trim()) {
          setError('Please enter a FIO handle');
          setLoading(false);
          return;
        }
        if (!state.fioAvailable) {
          setError('This handle is not available');
          setLoading(false);
          return;
        }
        setStep('wallet');
      } else if (step === 'wallet') {
        // Generate wallet and create persona
        setState(prev => ({ ...prev, walletGenerating: true }));
        
        // Generate wallet keys
        const { Wallet } = await import('ethers');
        const wallet = Wallet.createRandom();
        
        const fullHandle = `${state.fioHandle}@${state.selectedDomain}`;
        
        // Create persona directly in Supabase
        const { data: persona, error: personaError } = await supabase
          .from('persona')
          .insert({
            fio_handle: fullHandle,
            fio_public_key: wallet.publicKey,
            default_identity_state: 'semi_anonymous',
            world_id_status: state.identityType === 'human' ? 'verified_human' : 'verified_ai_agent',
            app_origin: 'theqriptopian',
          })
          .select()
          .single();

        if (personaError) {
          console.error('Persona creation error:', personaError);
          throw new Error(personaError.message || 'Failed to create persona');
        }

        // Link persona to user profile
        if (userId && persona?.id) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              persona_id: persona.id,
              display_name: state.displayName,
            }, {
              onConflict: 'id'
            });
          
          if (profileError) {
            console.error('Profile update error:', profileError);
            // Don't fail - persona was created successfully
          }
        }

        setState(prev => ({ ...prev, walletGenerating: false, walletGenerated: true }));
        setStep('welcome');
      } else if (step === 'welcome') {
        // Complete onboarding
        navigate('/');
      }
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'An error occurred');
      setState(prev => ({ ...prev, walletGenerating: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'fio') setStep('persona');
    else if (step === 'wallet') setStep('fio');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-primary/20 shadow-xl">
        <CardHeader className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              {steps.map((s, i) => (
                <div 
                  key={s.key}
                  className={`flex items-center gap-1 ${
                    i <= currentStepIndex ? 'text-primary' : ''
                  }`}
                >
                  {s.icon}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="text-center">
            <CardTitle className="text-2xl font-bold">
              {step === 'persona' && 'Create Your Profile'}
              {step === 'fio' && 'Choose Your Handle'}
              {step === 'wallet' && 'Set Up Your Wallet'}
              {step === 'welcome' && '🎉 Welcome!'}
            </CardTitle>
            <CardDescription className="mt-2">
              {step === 'persona' && 'Tell us a bit about yourself'}
              {step === 'fio' && 'Your unique identity across the iQube ecosystem'}
              {step === 'wallet' && 'Your secure Q¢ wallet is being created'}
              {step === 'welcome' && "You're all set to start earning Q¢"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step: Persona */}
          {step === 'persona' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="How should we call you?"
                  value={state.displayName}
                  onChange={(e) => setState(prev => ({ ...prev, displayName: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <div className="space-y-3">
                <Label>Identity Type</Label>
                <RadioGroup
                  value={state.identityType}
                  onValueChange={(v) => setState(prev => ({ ...prev, identityType: v as 'human' | 'ai_agent' }))}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:border-primary">
                    <RadioGroupItem value="human" id="human" />
                    <Label htmlFor="human" className="cursor-pointer">
                      <div className="font-medium">Human</div>
                      <div className="text-xs text-muted-foreground">Verified person</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:border-primary">
                    <RadioGroupItem value="ai_agent" id="ai_agent" />
                    <Label htmlFor="ai_agent" className="cursor-pointer">
                      <div className="font-medium">AI Agent</div>
                      <div className="text-xs text-muted-foreground">Autonomous agent</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step: FIO Handle */}
          {step === 'fio' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fioHandle">FIO Handle</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="fioHandle"
                    placeholder="yourhandle"
                    value={state.fioHandle}
                    onChange={(e) => setState(prev => ({ 
                      ...prev, 
                      fioHandle: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
                      fioAvailable: null
                    }))}
                    disabled={loading}
                    className="flex-1"
                  />
                  <select
                    value={state.selectedDomain}
                    onChange={(e) => {
                      const domain = e.target.value as HumanDomain;
                      setState(prev => ({ ...prev, selectedDomain: domain, fioAvailable: null }));
                      if (state.fioHandle) checkFioAvailability(state.fioHandle, domain);
                    }}
                    disabled={loading}
                    className="px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="qripto">@qripto</option>
                    <option value="knyt">@knyt</option>
                  </select>
                </div>
                
                {state.fioChecking && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking availability...
                  </p>
                )}
                {state.fioAvailable === true && !state.fioChecking && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {state.fioHandle}@{state.selectedDomain} is available!
                  </p>
                )}
                {state.fioAvailable === false && !state.fioChecking && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    This handle is already taken
                  </p>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-1">Your FIO Handle</p>
                <p className="text-muted-foreground">
                  This will be your universal identity for sending and receiving Q¢ 
                  across the iQube ecosystem. Choose wisely - it's permanent!
                </p>
              </div>
            </div>
          )}

          {/* Step: Wallet Generation */}
          {step === 'wallet' && (
            <div className="space-y-6 text-center py-8">
              {state.walletGenerating ? (
                <>
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">Creating your wallet...</p>
                    <p className="text-sm text-muted-foreground">
                      Generating secure keys and registering your FIO handle
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating wallet keys...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">Ready to create your wallet</p>
                    <p className="text-sm text-muted-foreground">
                      Click continue to generate your secure Q¢ wallet
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-sm text-left">
                    <p className="font-medium mb-2">What happens next:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Generate secure wallet keys</li>
                      <li>• Register @{state.fioHandle}@{state.selectedDomain}</li>
                      <li>• Create your DIDQube persona</li>
                      <li>• Award your welcome bonus</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="space-y-6 text-center py-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              
              <div className="space-y-2">
                <p className="text-xl font-bold">Welcome, {state.displayName}!</p>
                <p className="text-muted-foreground">
                  Your wallet is ready at @{state.fioHandle}@{state.selectedDomain}
                </p>
              </div>

              <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
                <CardContent className="py-6">
                  <div className="text-3xl font-bold text-primary">+50 Q¢</div>
                  <div className="text-sm text-muted-foreground">Welcome Bonus</div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                Start exploring content and earning more Q¢!
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {step !== 'persona' && step !== 'welcome' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading || state.walletGenerating}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={
                loading || 
                state.walletGenerating ||
                (step === 'fio' && !state.fioAvailable)
              }
              className="flex-1"
              size="lg"
            >
              {loading || state.walletGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {state.walletGenerating ? 'Creating...' : 'Loading...'}
                </>
              ) : (
                <>
                  {step === 'welcome' ? 'Start Exploring' : 'Continue'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
