import { NextRequest, NextResponse } from 'next/server';

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  author: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

  if (!feedUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllThingBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Parse RSS XML
    const posts: RSSItem[] = [];
    
    // Simple XML parsing (you might want to use a proper XML parser library)
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                    itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      
      const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || 
                         itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';
      
      const content = itemXml.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/)?.[1] || 
                     description;
      
      const author = itemXml.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] || 
                    itemXml.match(/<author>(.*?)<\/author>/)?.[1] || '';
      
      posts.push({
        title,
        link,
        pubDate,
        description,
        content,
        author,
      });
    }

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('RSS fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch RSS feed' },
      { status: 500 }
    );
  }
}
