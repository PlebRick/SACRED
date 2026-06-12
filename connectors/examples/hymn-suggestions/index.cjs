#!/usr/bin/env node
// Example SACRED connector: Hymn Suggestions
//
// A minimal MCP server demonstrating the connector pattern. It suggests
// public-domain hymns that match a sermon topic, for closing-hymn planning.
//
// Register it in SACRED (Settings → Connectors) as:
//   transport: stdio
//   command:   node
//   args:      ["connectors/examples/hymn-suggestions/index.cjs"]
//
// See docs/CONNECTORS.md for how to write your own connector like this one.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

// All hymns below are public domain.
const HYMNS = [
  {
    title: 'Amazing Grace',
    author: 'John Newton, 1779',
    topics: ['grace', 'salvation', 'conversion', 'testimony', 'mercy'],
    firstStanza:
      'Amazing grace! how sweet the sound, / That saved a wretch like me! / I once was lost, but now am found, / Was blind, but now I see.'
  },
  {
    title: 'A Mighty Fortress Is Our God',
    author: 'Martin Luther, 1529',
    topics: ['sovereignty', 'protection', 'spiritual warfare', 'trust', 'reformation'],
    firstStanza:
      'A mighty fortress is our God, / A bulwark never failing; / Our helper He amid the flood / Of mortal ills prevailing.'
  },
  {
    title: 'Holy, Holy, Holy',
    author: 'Reginald Heber, 1826',
    topics: ['trinity', 'holiness', 'worship', 'majesty', 'attributes of god'],
    firstStanza:
      'Holy, holy, holy! Lord God Almighty! / Early in the morning our song shall rise to Thee; / Holy, holy, holy! merciful and mighty! / God in three Persons, blessed Trinity!'
  },
  {
    title: 'When I Survey the Wondrous Cross',
    author: 'Isaac Watts, 1707',
    topics: ['cross', 'atonement', 'sacrifice', 'humility', 'devotion', 'communion'],
    firstStanza:
      'When I survey the wondrous cross / On which the Prince of glory died, / My richest gain I count but loss, / And pour contempt on all my pride.'
  },
  {
    title: 'It Is Well with My Soul',
    author: 'Horatio Spafford, 1873',
    topics: ['suffering', 'peace', 'trust', 'comfort', 'grief', 'assurance'],
    firstStanza:
      'When peace like a river attendeth my way, / When sorrows like sea billows roll; / Whatever my lot, Thou hast taught me to say, / It is well, it is well with my soul.'
  },
  {
    title: 'Great Is Thy Faithfulness',
    author: 'Thomas Chisholm, 1923',
    topics: ['faithfulness', 'providence', 'thanksgiving', 'attributes of god', 'new year'],
    firstStanza:
      'Great is Thy faithfulness, O God my Father; / There is no shadow of turning with Thee; / Thou changest not, Thy compassions, they fail not; / As Thou hast been, Thou forever wilt be.'
  },
  {
    title: 'Rock of Ages',
    author: 'Augustus Toplady, 1776',
    topics: ['atonement', 'refuge', 'justification', 'salvation', 'cross'],
    firstStanza:
      'Rock of Ages, cleft for me, / Let me hide myself in Thee; / Let the water and the blood, / From Thy wounded side which flowed, / Be of sin the double cure, / Save from wrath and make me pure.'
  },
  {
    title: 'Crown Him with Many Crowns',
    author: 'Matthew Bridges, 1851',
    topics: ['kingship', 'ascension', 'exaltation', 'worship', 'easter', 'resurrection'],
    firstStanza:
      'Crown Him with many crowns, / The Lamb upon His throne: / Hark! how the heavenly anthem drowns / All music but its own!'
  },
  {
    title: 'Be Thou My Vision',
    author: 'Irish, c. 8th century; tr. Mary Byrne, 1905',
    topics: ['devotion', 'guidance', 'wisdom', 'consecration', 'discipleship'],
    firstStanza:
      'Be Thou my vision, O Lord of my heart; / Naught be all else to me, save that Thou art; / Thou my best thought, by day or by night, / Waking or sleeping, Thy presence my light.'
  },
  {
    title: 'And Can It Be',
    author: 'Charles Wesley, 1738',
    topics: ['grace', 'atonement', 'freedom', 'conversion', 'amazement', 'justification'],
    firstStanza:
      "And can it be that I should gain / An interest in the Savior's blood? / Died He for me, who caused His pain— / For me, who Him to death pursued?"
  },
  {
    title: 'Christ the Lord Is Risen Today',
    author: 'Charles Wesley, 1739',
    topics: ['resurrection', 'easter', 'victory', 'joy'],
    firstStanza:
      'Christ the Lord is risen today, Alleluia! / Earth and heaven in chorus say, Alleluia! / Raise your joys and triumphs high, Alleluia! / Sing, ye heavens, and earth reply, Alleluia!'
  },
  {
    title: 'Come, Thou Fount of Every Blessing',
    author: 'Robert Robinson, 1758',
    topics: ['grace', 'thanksgiving', 'perseverance', 'wandering', 'redemption'],
    firstStanza:
      'Come, Thou Fount of every blessing, / Tune my heart to sing Thy grace; / Streams of mercy, never ceasing, / Call for songs of loudest praise.'
  }
];

const server = new McpServer({ name: 'hymn-suggestions', version: '1.0.0' });

server.tool(
  'suggest_hymns',
  'Suggest public-domain hymns matching a sermon topic or theme (e.g. "grace", "resurrection", "suffering").',
  { topic: z.string().describe('Topic or theme to match, e.g. "grace"') },
  async ({ topic }) => {
    const q = topic.toLowerCase();
    const matches = HYMNS.filter(
      (h) =>
        h.topics.some((t) => t.includes(q) || q.includes(t)) ||
        h.title.toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: `No hymns found for "${topic}". Topics include: ${[...new Set(HYMNS.flatMap((h) => h.topics))].sort().join(', ')}` }]
      };
    }
    const text = matches
      .map((h) => `**${h.title}** (${h.author})\nThemes: ${h.topics.join(', ')}\n${h.firstStanza}`)
      .join('\n\n');
    return { content: [{ type: 'text', text }] };
  }
);

server.tool(
  'get_hymn',
  'Get a hymn by (partial) title, with author and first stanza.',
  { title: z.string().describe('Hymn title, full or partial') },
  async ({ title }) => {
    const q = title.toLowerCase();
    const hymn = HYMNS.find((h) => h.title.toLowerCase().includes(q));
    if (!hymn) {
      return { content: [{ type: 'text', text: `No hymn found matching "${title}".` }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `**${hymn.title}**\n${hymn.author}\nThemes: ${hymn.topics.join(', ')}\n\n${hymn.firstStanza}`
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
