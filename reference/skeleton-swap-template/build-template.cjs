#!/usr/bin/env node
// build-template.cjs
// Generates a MINIMAL Spine 4.3.x skeleton.json for character-swap demos.
//
// Structure (lean version):
//   - 20 bones total: 18 shared humanoid + weapon-l / weapon-r dual-wield sub-bones
//   - NO skin-bones (no physics chains). All swap is pure attachment swap.
//   - 20 slots for body parts + face + hair + weapons
//   - 8 demo skins
//   - 1 'idle' animation
//
// Use case: chibi / card / casual / sticker characters where physics
// is overkill. If you later need hair/cape/dress physics, add skin-bones
// and re-import — the slot/bone names are compatible.
//
// Output: skeleton.json
// Usage:  node build-template.cjs

'use strict';
const fs = require('fs');
const path = require('path');

// --- helpers --------------------------------------------------------

function bone(name, opts = {}) {
  const o = { name };
  if (opts.parent) o.parent = opts.parent;
  if (opts.length !== undefined) o.length = opts.length;
  if (opts.rotation !== undefined) o.rotation = opts.rotation;
  if (opts.x !== undefined) o.x = opts.x;
  if (opts.y !== undefined) o.y = opts.y;
  return o;
}

function slot(name, boneName, attachment) {
  const o = { name, bone: boneName };
  if (attachment) o.attachment = attachment;
  return o;
}

// 16x16 placeholder region attachment.
// Replace these in Spine editor with your actual art.
function regionAttachment(name, x = 0, y = 0, rotation = 0, width = 16, height = 16) {
  return { name, type: 'region', x, y, rotation, width, height };
}

function skinWithAttachments(name, attachments) {
  return { name, attachments };
}

// --- bones (20 total) -----------------------------------------------

const bones = [
  // root
  bone('root'),

  // hip / body
  bone('hip',   { parent: 'root', x: 0,   y: 80 }),
  bone('body',  { parent: 'hip',  x: 0,   y: 20, length: 40 }),
  bone('head',  { parent: 'body', x: 0,   y: 50, length: 16 }),

  // arms (1=left front, 2=right front)
  bone('upperarm1', { parent: 'body',    x: -14, y: 32, length: 16 }),
  bone('forearm1',  { parent: 'upperarm1', x: 0,  y: 16, length: 14 }),
  bone('hand1',     { parent: 'forearm1',  x: 0,  y: 14 }),
  bone('upperarm2', { parent: 'body',    x:  14, y: 32, length: 16 }),
  bone('forearm2',  { parent: 'upperarm2', x: 0,  y: 16, length: 14 }),
  bone('hand2',     { parent: 'forearm2',  x: 0,  y: 14 }),

  // legs
  bone('thigh1', { parent: 'hip',   x: -7, y: -2, length: 18 }),
  bone('shin1',  { parent: 'thigh1', x: 0,  y: 18, length: 18 }),
  bone('foot1',  { parent: 'shin1',  x: 0,  y: 18 }),
  bone('thigh2', { parent: 'hip',   x:  7, y: -2, length: 18 }),
  bone('shin2',  { parent: 'thigh2', x: 0,  y: 18, length: 18 }),
  bone('foot2',  { parent: 'shin2',  x: 0,  y: 18 }),

  // dual-wield weapon sub-bones
  bone('weapon-l', { parent: 'hand1', x: 0, y: 6 }),
  bone('weapon-r', { parent: 'hand2', x: 0, y: 6 }),
];

// --- slots (20 total) ----------------------------------------------

const slots = [
  // legs (back layer)
  slot('thigh1', 'thigh1', 'thigh'),
  slot('shin1',  'shin1',  'shin'),
  slot('foot1',  'foot1',  'foot'),
  slot('thigh2', 'thigh2', 'thigh'),
  slot('shin2',  'shin2',  'shin'),
  slot('foot2',  'foot2',  'foot'),

  // torso
  slot('body', 'body', 'torso'),

  // arms
  slot('upperarm1', 'upperarm1', 'upper-arm'),
  slot('upperarm2', 'upperarm2', 'upper-arm'),
  slot('forearm1',  'forearm1',  'forearm'),
  slot('forearm2',  'forearm2',  'forearm'),
  slot('hand1',     'hand1',     'hand'),
  slot('hand2',     'hand2',     'hand'),

  // head & face
  slot('head',  'head', 'head'),
  slot('eyes',  'head'),
  slot('mouth', 'head'),

  // hair (front layer over face)
  slot('hair-back',  'head'),
  slot('hair-front', 'head'),

  // weapons (top layer)
  slot('weapon-l', 'weapon-l'),
  slot('weapon-r', 'weapon-r'),
];

// --- skins (8 total) -----------------------------------------------

// Body part attachments — these get reused by every outfit.
const bodyAttachments = {
  'body':      { torso:      regionAttachment('torso',      0,  0, 0, 28, 40) },
  'upperarm1': { 'upper-arm': regionAttachment('upper-arm', 0,  0, 0,  8, 16) },
  'upperarm2': { 'upper-arm': regionAttachment('upper-arm', 0,  0, 0,  8, 16) },
  'forearm1':  { forearm:    regionAttachment('forearm',    0,  0, 0,  7, 14) },
  'forearm2':  { forearm:    regionAttachment('forearm',    0,  0, 0,  7, 14) },
  'hand1':     { hand:       regionAttachment('hand',       0,  0, 0,  8,  8) },
  'hand2':     { hand:       regionAttachment('hand',       0,  0, 0,  8,  8) },
  'thigh1':    { thigh:      regionAttachment('thigh',      0,  0, 0,  9, 18) },
  'thigh2':    { thigh:      regionAttachment('thigh',      0,  0, 0,  9, 18) },
  'shin1':     { shin:       regionAttachment('shin',       0,  0, 0,  8, 18) },
  'shin2':     { shin:       regionAttachment('shin',       0,  0, 0,  8, 18) },
  'foot1':     { foot:       regionAttachment('foot',       0,  0, 0, 10,  6) },
  'foot2':     { foot:       regionAttachment('foot',       0,  0, 0, 10,  6) },
};

// --- 1. skin-base: body + face only ---------------------------------
const skinBase = skinWithAttachments('skin-base', {
  ...bodyAttachments,
  'head':  { head:  regionAttachment('head',  0,  8, 0, 24, 28) },
  'eyes':  { eyes:  regionAttachment('eyes',  0, 12, 0, 10,  4) },
  'mouth': { mouth: regionAttachment('mouth', 0,  4, 0,  6,  3) },
});

// --- 2. hair/short-brown --------------------------------------------
const skinHairShortBrown = skinWithAttachments('hair/short-brown', {
  'hair-back':  { 'hair-short-brown-back':  regionAttachment('hair-short-brown-back',  0,  6, 0, 22, 14) },
  'hair-front': { 'hair-short-brown-front': regionAttachment('hair-short-brown-front', 0, 12, 0, 22, 10) },
});

const skinHairShortBlue = skinWithAttachments('hair/short-blue', {
  'hair-back':  { 'hair-short-blue-back':  regionAttachment('hair-short-blue-back',  0,  6, 0, 22, 14) },
  'hair-front': { 'hair-short-blue-front': regionAttachment('hair-short-blue-front', 0, 12, 0, 22, 10) },
});

// --- 3. hair/long-brown (still no skin-bones — just a longer image) -
const skinHairLongBrown = skinWithAttachments('hair/long-brown', {
  'hair-back':  { 'hair-long-brown-back':  regionAttachment('hair-long-brown-back',  0,  0, 0, 22, 40) },
  'hair-front': { 'hair-long-brown-front': regionAttachment('hair-long-brown-front', 0, 12, 0, 22, 10) },
});

// --- 4. clothes/tshirt-red (just changes body attachment) -----------
const skinTshirtRed = skinWithAttachments('clothes/tshirt-red', {
  'body': { 'tshirt-red': regionAttachment('tshirt-red', 0, 0, 0, 28, 40) },
});

// --- 5. clothes/dress-blue (longer body + adds skirt layer) ---------
// For "dress" without skin-bones, we just override 'body' to be a longer
// image and add a separate 'dress-front' attachment slot... but we kept
// the template minimal so we just resize 'body' for dresses.
const skinDressBlue = skinWithAttachments('clothes/dress-blue', {
  'body': { 'dress-blue': regionAttachment('dress-blue', 0, 12, 0, 28, 60) },
});

// --- 6. weapon-l/sword (dual-wield left) ----------------------------
const skinWeaponLSword = skinWithAttachments('weapon-l/sword', {
  'weapon-l': { sword: regionAttachment('sword', 0, -16, 0, 4, 32) },
});

const skinWeaponLDagger = skinWithAttachments('weapon-l/dagger', {
  'weapon-l': { dagger: regionAttachment('dagger', 0, -10, 0, 3, 20) },
});

// --- 7. weapon-r/shield (dual-wield right) --------------------------
const skinWeaponRShield = skinWithAttachments('weapon-r/shield', {
  'weapon-r': { shield: regionAttachment('shield', -10, -10, 0, 20, 20) },
});

const skinWeaponRBow = skinWithAttachments('weapon-r/bow', {
  'weapon-r': { bow: regionAttachment('bow', -2, -18, 0, 8, 36) },
});

// --- animations (1: idle only) -------------------------------------

// Single-frame animations (no movement) for static demo:
//   - 'idle': gentle body bob (no physics, just the base skeleton)

function boneTimeline(name, frames) {
  const hasRot = frames.some(f => f.rotation !== undefined);
  const hasTrans = frames.some(f => f.x !== undefined || f.y !== undefined);

  const tl = {};
  if (hasRot) {
    tl.rotate = frames.filter(f => f.rotation !== undefined)
      .map(f => ({ time: f.time, value: f.rotation }));
    if (tl.rotate.length > 1) tl.rotate[0].curve = 'linear';
  }
  if (hasTrans) {
    tl.translate = frames.filter(f => f.x !== undefined || f.y !== undefined)
      .map(f => ({ time: f.time, x: f.x || 0, y: f.y || 0 }));
    if (tl.translate.length > 1) tl.translate[0].curve = 'linear';
  }
  return { [name]: tl };
}

function mergeTimelines(anim, ...timelines) {
  for (const t of timelines) {
    for (const [boneName, tl] of Object.entries(t)) {
      anim.bones[boneName] = anim.bones[boneName] || {};
      Object.assign(anim.bones[boneName], tl);
    }
  }
}

const idle = { bones: {} };
mergeTimelines(idle,
  boneTimeline('body', [
    { time: 0,   y: 0 },
    { time: 0.5, y: 2 },
    { time: 1.0, y: 0 },
  ])
);

// --- assemble skeleton ---------------------------------------------

const skeleton = {
  skeleton: {
    hash: '       ',
    spine: '4.3.75',
    x: -80,
    y: -10,
    width: 160,
    height: 220,
    images: './images/',
    audio: null,
  },
  bones,
  slots,
  skins: [
    skinBase,
    skinHairShortBrown,
    skinHairShortBlue,
    skinHairLongBrown,
    skinTshirtRed,
    skinDressBlue,
    skinWeaponLSword,
    skinWeaponLDagger,
    skinWeaponRShield,
    skinWeaponRBow,
  ],
  events: {},
  animations: { idle },
};

// --- write --------------------------------------------------------

const outPath = path.join(__dirname, 'skeleton.json');
fs.writeFileSync(outPath, JSON.stringify(skeleton, null, '\t') + '\n', 'utf8');

// --- summary ------------------------------------------------------

console.log('=== Spine 4.3 LEAN swap-template skeleton.json written ===');
console.log('  path:  ' + outPath);
console.log('  bones: ' + bones.length);
console.log('  slots: ' + slots.length);
console.log('  skins: ' + skeleton.skins.length);
console.log('  anims: ' + Object.keys(skeleton.animations).join(', '));
console.log();
console.log('  No skin-bones. Pure attachment swap.');
console.log();
console.log('Next steps:');
console.log('  1. Open Spine 4.3 editor');
console.log('  2. Spine menu → Import Data → select skeleton.json');
console.log('  3. Save as skeleton.spine');
console.log('  4. Replace 16x16 placeholders with your art');
console.log('  5. Compose outfits at runtime via new Skin() + AddSkin() + SetSkin()');
