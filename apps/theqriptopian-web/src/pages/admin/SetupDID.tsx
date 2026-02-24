import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AigentZClient } from '@/lib/aigentz-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

export default function SetupDID() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [did, setDid] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleGenerateDID = () => {
    // Generate a simple DID for demo purposes
    // In production, this should use proper DID generation
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const generatedDID = `did:qriptoagent:${timestamp}-${random}`;
    setDid(generatedDID);
    toast({
      title: 'DID Generated',
      description: 'A demo DID has been generated. In production, use proper DID generation.',
    });
  };

  const handleVerifyAndSave = async () => {
    if (!did.trim()) {
      setErrorMessage('Please enter or generate a DID');
      setStatus('error');
      return;
    }

    setLoading(true);
    setVerifying(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Not authenticated');
      }

      // Step 1: Verify DID with AA-API
      console.log('[SetupDID] Authenticating with AA-API for DID:', did);
      
      const client = new AigentZClient({
        did: did.trim(),
        signNonce: async (nonce) => {
          // Phase 1: Stub signature (any non-empty string)
          // In production, implement proper signature with private key
          return nonce;
        },
      });

      try {
        const aaToken = await client.getToken();
        console.log('[SetupDID] AA-API authentication successful');
        
        // Step 2: Save DID mapping to database
        const { error: insertError } = await supabase
          .from('user_did_mapping')
          .upsert({
            user_id: user.id,
            did: did.trim(),
            verified_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (insertError) {
          throw insertError;
        }

        setStatus('success');
        toast({
          title: 'DID Linked Successfully',
          description: 'Your DID has been verified and linked to your account.',
        });

        // Redirect to admin dashboard after 2 seconds
        setTimeout(() => {
          navigate('/admin');
        }, 2000);

      } catch (aaError) {
        console.error('[SetupDID] AA-API authentication failed:', aaError);
        throw new Error('Failed to authenticate with AA-API. Please check your DID and try again.');
      }

    } catch (error) {
      console.error('[SetupDID] Error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to setup DID');
      toast({
        title: 'Setup Failed',
        description: error instanceof Error ? error.message : 'Failed to setup DID',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Setup DID Authentication</CardTitle>
          </div>
          <CardDescription>
            Link your Decentralized Identifier (DID) to enable AA-API based admin authentication.
            This provides enhanced security and integrates with the Aigent Z ecosystem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'success' && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                DID successfully linked! Redirecting to admin dashboard...
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="did" className="text-sm font-medium">
                Decentralized Identifier (DID)
              </label>
              <Input
                id="did"
                type="text"
                placeholder="did:example:your-identifier"
                value={did}
                onChange={(e) => setDid(e.target.value)}
                disabled={loading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter your existing DID or generate a demo DID for testing.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleGenerateDID}
                disabled={loading}
                className="flex-1"
              >
                Generate Demo DID
              </Button>
              <Button
                onClick={handleVerifyAndSave}
                disabled={loading || !did.trim()}
                className="flex-1"
              >
                {verifying ? 'Verifying...' : loading ? 'Saving...' : 'Verify & Link DID'}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">How it works:</h4>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Generate or enter your DID</li>
              <li>The system verifies your DID with the AA-API</li>
              <li>Your DID is linked to your Supabase account</li>
              <li>Future admin checks use AA-API authentication</li>
            </ol>
            <p className="text-xs mt-4 p-3 bg-muted rounded">
              <strong>Note:</strong> Phase 1 uses simplified signature verification. 
              In production, proper cryptographic signatures will be required.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
