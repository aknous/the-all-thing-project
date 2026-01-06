# app/aiContext.py
"""
AI-powered poll context generation service.
Uses OpenAI GPT-4 to generate neutral, educational background information for polls.
"""

import httpx
from typing import Optional
from .settings import settings
from .logger import logger


SYSTEM_PROMPT = """You are a neutral, educational assistant that provides factual context for poll questions.

Your task is to provide background information that helps voters understand the poll question without bias.

Guidelines:
- Stay completely neutral and objective
- Provide factual background and key perspectives
- Include relevant definitions if needed
- Cite sources where appropriate (use general knowledge, no need for specific URLs)
- Keep it concise: 200-400 words
- Use markdown formatting for readability (headers, lists, bold, etc.)
- Do NOT advocate for any particular option
- Do NOT make predictions about voting outcomes
- Focus on helping voters make informed decisions

Format your response as markdown text."""


async def generatePollContext(
    title: str,
    question: Optional[str],
    optionLabels: list[str]
) -> str:
    """
    Generate AI-powered context for a poll using OpenAI GPT-4.
    
    Args:
        title: Poll title
        question: Optional poll question (may be None)
        optionLabels: List of option labels for the poll
        
    Returns:
        Markdown-formatted context text
        
    Raises:
        ValueError: If OpenAI API key is not configured
        Exception: If API call fails
    """
    api_key = settings.openai_api_key
    if not api_key:
        raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")
    
    # Build user prompt
    user_prompt = f"""Generate neutral, educational context for this poll:

Title: {title}
"""
    
    if question:
        user_prompt += f"Question: {question}\n"
    
    user_prompt += f"\nOptions:\n"
    for i, label in enumerate(optionLabels, 1):
        user_prompt += f"{i}. {label}\n"
    
    user_prompt += "\nProvide factual background that helps voters understand this poll question. Use markdown formatting."
    
    # Call OpenAI API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 800
                }
            )
            response.raise_for_status()
            
            data = response.json()
            context_text = data["choices"][0]["message"]["content"].strip()
            
            logger.info(f"Generated AI context for poll '{title}' ({len(context_text)} chars)")
            return context_text
            
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
        raise Exception(f"OpenAI API error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Failed to generate AI context: {str(e)}")
        raise
