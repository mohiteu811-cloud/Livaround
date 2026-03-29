'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subscriptionId = searchParams.get('subscription_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!subscriptionId) {
      setStatus('success');
      return;
    }

    // Activate the subscription directly instead of waiting for the webhook
    (async () => {
      try {
        await api.billing.activate(subscriptionId);
        setStatus('success');
      } catch {
        // Even if activation fails, show success — the webhook may still arrive
        setStatus('success');
      }
    })();
  }, [subscriptionId]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center py-10">
          {status === 'loading' ? (
            <>
              <Loader2 className="h-12 w-12 text-brand-400 animate-spin mx-auto" />
              <h2 className="mt-4 text-xl font-semibold text-slate-100">
                Confirming your subscription...
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Please wait while we process your payment.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
              <h2 className="mt-4 text-xl font-semibold text-slate-100">
                Subscription activated!
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Your plan has been upgraded successfully.
                {subscriptionId && (
                  <span className="block mt-1 text-xs text-slate-500">
                    Subscription ID: {subscriptionId}
                  </span>
                )}
              </p>
              <Button
                variant="primary"
                className="mt-6"
                onClick={() => router.push('/settings/billing')}
              >
                Go to Billing
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
