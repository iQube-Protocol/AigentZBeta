"use client";

/**
 * Test Payment Integration Page
 * 
 * This page demonstrates the SmartContent payment integration.
 * It shows a sample content item with pricing that triggers the payment flow.
 */

import { useState } from "react";
import { SmartContentActions } from "@/app/components/content/SmartContentActions";
import { useSmartContentHandler } from "@/app/hooks/useSmartContentAction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SmartContentItem } from "@/packages/smarttriad/src/types";

// Sample content items with different pricing
const sampleContent: SmartContentItem[] = [
  {
    id: "test-1",
    title: "Digital Art Collection",
    description: "Exclusive digital artwork with limited edition NFTs",
    excerpt: "Beautiful digital art collection",
    image: "https://picsum.photos/400/300?random=1",
    section: "art",
    price: {
      amount: 250, // 2.50 Q¢
      currency: "Q¢",
      paymentType: "one-time"
    },
    modalities: {
      view: {
        image_url: "https://picsum.photos/400/300?random=1"
      }
    }
  },
  {
    id: "test-2", 
    title: "Premium Video Course",
    description: "Advanced blockchain development course",
    excerpt: "Learn blockchain development",
    image: "https://picsum.photos/400/300?random=2",
    section: "education",
    price: {
      amount: 500, // 5.00 Q¢
      currency: "Q¢", 
      paymentType: "one-time"
    },
    modalities: {
      watch: {
        video_url: "https://example.com/video.mp4",
        available: true,
        type: "video",
        thumbnail: "https://picsum.photos/400/300?random=2"
      }
    }
  },
  {
    id: "test-3",
    title: "Free Content",
    description: "This content is free to access",
    excerpt: "No payment required",
    image: "https://picsum.photos/400/300?random=3",
    section: "free",
    modalities: {
      read: {
        text: "This is free content that anyone can access without payment.",
        available: true
      }
    }
  },
  {
    id: "test-4",
    title: "Subscription Content",
    description: "Monthly subscription for premium content",
    excerpt: "Subscribe for unlimited access",
    image: "https://picsum.photos/400/300?random=4",
    section: "premium",
    price: {
      amount: 1000, // 10.00 Q¢ per month
      currency: "Q¢",
      paymentType: "subscription"
    },
    paymentMetadata: {
      paymentSurface: "overlay" // Explicitly choose overlay
    },
    modalities: {
      read: {
        text: "Premium subscription content with exclusive articles and resources.",
        available: true
      }
    }
  }
];

export default function TestPaymentPage() {
  const [selectedItem, setSelectedItem] = useState<SmartContentItem | null>(null);
  
  // Get the global smart content handler
  const handleAction = useSmartContentHandler(selectedItem || sampleContent[0], sampleContent);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">SmartContent Payment Integration Test</h1>
        <p className="text-white/60">
          Test the global payment system by clicking the buy buttons on priced content.
          The payment flow will automatically detect the optimal payment surface.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sampleContent.map((item) => {
          const itemHandler = useSmartContentHandler(item, sampleContent);
          const price = item.price;
          const hasPrice = typeof price?.amount === "number" && price.amount > 0;
          
          return (
            <Card key={item.id} className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">{item.title}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {item.description}
                    </CardDescription>
                  </div>
                  {hasPrice && price && (
                    <div className="text-right">
                      <div className="text-amber-400 font-bold">
                        {(price.amount / 100).toFixed(2)} Q¢
                      </div>
                      <div className="text-xs text-slate-400">
                        {price.paymentType === 'subscription' ? 'per month' : 'one-time'}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      Section: {item.section}
                    </div>
                    
                    {/* SmartContentActions with price support */}
                    <SmartContentActions
                      modalities={item.modalities ?? null}
                      onAction={itemHandler}
                      item={item}
                      size="sm"
                      showShare={true}
                    />
                  </div>
                  
                  {item.paymentMetadata?.paymentSurface && (
                    <div className="text-xs text-slate-500">
                      Preferred payment surface: {item.paymentMetadata.paymentSurface}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
        <ol className="space-y-2 text-slate-300">
          <li>1. Click the buy button on any priced content above</li>
          <li>2. The SmartContentActionContext detects the price and payment surface preference</li>
          <li>3. A payment event is dispatched to the appropriate payment surface:</li>
          <li className="ml-6">• <strong>Overlay</strong>: SmartWalletDrawer opens with purchase flow</li>
          <li className="ml-6">• <strong>Liquid UI</strong>: Payment chips in chat surface (flagged for integration)</li>
          <li className="ml-6">• <strong>Embedded</strong>: Copilot payment components (flagged for integration)</li>
          <li>4. Complete the purchase using existing payment infrastructure</li>
          <li>5. Content access is granted automatically after successful payment</li>
        </ol>
        
        <div className="mt-4 p-4 bg-slate-900 rounded-lg">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Integration Status</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>✅ Global SmartContent provider: Active</li>
            <li>✅ Price detection and display: Working</li>
            <li>✅ Overlay payment surface: Connected to SmartWalletDrawer</li>
            <li>🚩 Liquid UI payment surface: Integration point flagged</li>
            <li>🚩 Embedded payment surface: Integration point flagged</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
