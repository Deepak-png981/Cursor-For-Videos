"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createProject } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const STARTER_PROMPTS = [
  "Explain Pythagoras Theorem visually",
  "Visualize Bubble Sort algorithm",
  "Show a rotating 3D Cube",
  "Demonstrate projectile motion physics",
  "Illustrate the area of a circle formula"
];

export default function ProjectWizard() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { project_id } = await createProject(text);
      router.push(`/projects/${project_id}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          Cursor Video Platform
        </h1>
        <p className="text-muted-foreground text-lg">
          Turn your ideas into educational videos with AI-powered Gemini video generation.
        </p>
      </div>
      
      <div className="space-y-4">
        <Textarea 
          placeholder="Describe the video you want to generate... (e.g., 'Explain the Pythagorean theorem with a visual proof')" 
          className="h-32 text-lg shadow-sm resize-none p-4"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button 
          size="lg" 
          className="w-full text-md h-12" 
          onClick={() => handleSubmit(prompt)} 
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating Project...
            </>
          ) : "Generate Video"}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground font-medium text-center">Or try one of these:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {STARTER_PROMPTS.map((starter) => (
            <Button 
              key={starter} 
              variant="outline" 
              size="sm"
              className="rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
              onClick={() => {
                setPrompt(starter);
                // Optional: Auto-submit or just fill
                // handleSubmit(starter); 
              }}
            >
              {starter}
            </Button>
          ))}
        </div>
      </div>
      
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
           <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
           <h2 className="text-xl font-semibold">Initializing Workspace...</h2>
           <p className="text-muted-foreground">Setting up your AI director and animator agents.</p>
        </div>
      )}
    </div>
  );
}
