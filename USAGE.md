## Detailed Usage

### Command Line Options

```bash
./generate-pitch.sh [OPTIONS]

Options:
  -t, --title TITLE           Issue title (required)
  -T, --team-id ID            Linear team ID (required for --create)
  -s, --slack-thread URL      Slack thread URL or channel name
  -l, --linear-issue ID       Related Linear issue ID
  -n, --notion-page ID        Notion page ID to include
  -f, --files PATTERN         File pattern to analyze
  -o, --output FILE           Output file (default: auto-generated)
  -a, --appetite APPETITE     Appetite: small-batch|big-batch
  --otter-meeting ID          Otter.ai meeting ID (via Zapier)
  --requester NAME            Requester name
  --create                    Create issue directly in Linear
  --customer NAME             Create customer request for NAME (requires --create)
  --interactive               Interactive mode with prompts
  -v, --verbose               Show detailed progress
  -h, --help                  Show help message
```

## Linear Issue Format (Shape Up)

The system generates Linear issues following the Shape Up methodology:

### Generated Issue Structure

```markdown
# Problem

Articulate the problem that this piece of work addresses
What is the status quo and why does that not work?
Why does the problem matter?
Why is this the right time to address this problem?

# Appetite

How much time and resources are we willing to spend to address this problem?
[small-batch: 1-2 weeks | big-batch: 4-6 weeks]

# Solution

Give a "fat marker" sketch of the solution, identifying key architectural or design decisions. 
Tie the scope back to the appetite — are we confident we can build this with the resources we're willing to spend on it?
What are the constraints on the solution?

# Out of Bounds & Rabbit Holes

Identify and describe potential hurdles or areas of uncertainty in the proposed solution
Describe any areas that are intentionally out of scope
```
