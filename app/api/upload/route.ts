import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export async function POST(request: Request) {
  try {
    await authorize();
    if (!supabase) {
        return NextResponse.json({ error: 'Storage not configured (Supabase)' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;

    // 1. Try Uploading
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      });

    // 2. Self-Healing: If Bucket missing, try to create it
    if (error && (error as any).statusCode === '404' && (error as any).error === 'Bucket not found') {
       console.log("Bucket 'uploads' missing. Attempting to create...");
       const { error: createError } = await supabase.storage.createBucket('uploads', {
          public: true
       });
       
       if (createError) {
          console.error("Auto-creation failed:", createError);
          return NextResponse.json({ 
             error: 'Supabase Bucket "uploads" missing. Please create a PUBLIC bucket named "uploads" in your Supabase Dashboard.' 
          }, { status: 500 });
       }

       // Retry Upload
       const { error: retryError } = await supabase.storage
        .from('uploads')
        .upload(filename, buffer, { contentType: file.type, upsert: false });
       
       if (retryError) throw retryError;
    } else if (error) {
       throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filename);
      
    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('Upload Error detailed:', error);
    return NextResponse.json({ 
        error: error.message || 'Failed to upload file' 
    }, { status: 500 });
  }
}
