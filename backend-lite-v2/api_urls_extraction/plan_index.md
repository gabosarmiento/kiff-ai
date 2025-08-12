# API URLs Extraction Plan

## Phase 1: URL Extraction for All 48 APIs

**Goal**: Extract all documentation URLs from each API's sitemap
**Output**: One JSON file per API containing all discovered URLs
**Strategy**: Use /admin/url_extractor/extract endpoint for each API

### Progress Checklist

- [x] 01. OpenAI (platform.openai.com) - ✅ 571 URLs
- [x] 02. Anthropic (docs.anthropic.com) - ✅ 97 URLs  
- [x] 03. Google Gemini AI (ai.google.dev) - ❌ 0 URLs 
- [x] 04. Groq (console.groq.com) - ❌ 0 URLs
- [x] 05. Mistral AI (docs.mistral.ai) - ❌ 0 URLs
- [ ] 06. Together AI (docs.together.ai)
- [x] 07. Cohere (docs.cohere.com) - ✅ 134 URLs
- [ ] 08. Hugging Face (huggingface.co)
- [ ] 09. Rasa (rasa.com)
- [ ] 10. ElevenLabs (docs.elevenlabs.io)
- [ ] 11. Play.ht (docs.play.ht)
- [ ] 12. AssemblyAI (www.assemblyai.com)
- [ ] 13. Deepgram (developers.deepgram.com)
- [ ] 14. Speechmatics (docs.speechmatics.com)
- [ ] 15. Murf AI (murf.ai)
- [ ] 16. Stability AI (platform.stability.ai)
- [ ] 17. Leonardo.ai (docs.leonardo.ai)
- [ ] 18. Ideogram (ideogram.ai)
- [ ] 19. Runway (docs.runwayml.com)
- [ ] 20. Clipdrop (clipdrop.co)
- [ ] 21. Freepik API (developer.freepik.com)
- [ ] 22. DeepAI (deepai.org)
- [ ] 23. Synthesia (docs.synthesia.io)
- [ ] 24. Pictory (pictory.ai)
- [ ] 25. HeyGen (docs.heygen.com)
- [ ] 26. Fliki (fliki.ai)
- [ ] 27. Luma AI (lumalabs.ai)
- [ ] 28. Pinecone (docs.pinecone.io)
- [ ] 29. Weaviate (weaviate.io)
- [ ] 30. LangChain API (api.python.langchain.com)
- [ ] 31. Metaphor (docs.metaphor.systems)
- [ ] 32. Stripe (stripe.com)
- [x] 33. Supabase (supabase.com) - ✅ 1,921 URLs
- [ ] 34. E2B.dev (e2b.dev)
- [ ] 35. Agno (docs.agno.com)
- [ ] 36. Apify (docs.apify.com)
- [ ] 37. CrewAI (crew.ai)
- [ ] 38. Relevance AI (docs.relevance.ai)
- [ ] 39. LangGraph (langchain.com)
- [ ] 40. AutoGen (microsoft.github.io)
- [ ] 41. MetaGPT (meta-gpt.com)
- [ ] 42. SmolAgents (huggingface.co)
- [ ] 43. AgentLite (github.com)
- [ ] 44. AgentScope (github.com)
- [ ] 45. Dify (docs.dify.ai)
- [ ] 46. Composio (composio.ai)
- [ ] 47. Toolhouse (toolhouse.ai)
- [ ] 48. Vercel AI SDK (vercel.com)
- [ ] 49. Gradio (gradio.app)

### File Naming Convention
- `{api_name}_urls.json` - Contains all URLs for each API
- `{api_name}_stats.txt` - Summary stats (URL count, extraction time)

### Next Steps (Phase 2)
After URL extraction is complete:
1. Review all collected URLs
2. Plan chunking strategy per API based on content type
3. Execute semantic/document chunking for each API
4. Create vector embeddings for search

---
**Started**: $(date)
**Status**: In Progress - URL Extraction Phase