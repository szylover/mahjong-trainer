import type { ExplanationSections } from '../types';
import type { EfficiencyResult } from './efficiency';
import type { HandStructure } from './structure';
import type { WaitQualityResult } from './waitQuality';

function formatList(items: string[]): string {
  return items.length > 0 ? items.join('、') : '无';
}

function getOptionMap(options: EfficiencyResult[]): Map<string, EfficiencyResult> {
  return new Map(options.map((option) => [option.discard, option]));
}

function getWaitQualityMap(options?: WaitQualityResult[]): Map<string, WaitQualityResult> {
  return new Map((options ?? []).map((option) => [option.discard, option]));
}

function buildHandStructureText(structure: HandStructure): string {
  const mentsuText = structure.mentsu.length > 0
    ? formatList(structure.mentsu.map((item) => item.description))
    : '无';
  const taatsuText = structure.taatsu.length > 0
    ? formatList(structure.taatsu.map((item) => item.description))
    : '无';
  const pairText = structure.jantai?.description ?? '无雀头';
  const isolatedText = structure.isolated.length > 0 ? formatList(structure.isolated) : '无';

  return `手牌有${structure.mentsu.length}组面子(${mentsuText})、${structure.taatsu.length}组搭子(${taatsuText})、${pairText}和${structure.isolated.length}张孤立牌(${isolatedText})。`;
}

function findComponentDescription(structure: HandStructure, tile: string): string | null {
  const mentsu = structure.mentsu.find((item) => item.tiles.includes(tile));
  if (mentsu) {
    return mentsu.description;
  }

  const taatsu = structure.taatsu.find((item) => item.tiles.includes(tile));
  if (taatsu) {
    return taatsu.description;
  }

  if (structure.jantai?.tile === tile) {
    return structure.jantai.description;
  }

  return null;
}

function buildBestReason(
  bestOption: EfficiencyResult,
  compareTarget: EfficiencyResult | undefined,
  bestWaitQuality?: WaitQualityResult,
  compareWaitQuality?: WaitQualityResult,
): string {
  const reasons: string[] = [];

  if (compareTarget) {
    if (bestOption.shantenAfter < compareTarget.shantenAfter) {
      reasons.push(`打${bestOption.discard}能维持${bestOption.shantenAfter}向听，而打${compareTarget.discard}会退到${compareTarget.shantenAfter}向听。`);
    } else if (bestOption.ukeire > compareTarget.ukeire) {
      reasons.push(`打${bestOption.discard}后受入${bestOption.ukeire}枚，比${compareTarget.discard}多${bestOption.ukeire - compareTarget.ukeire}枚。`);
    } else {
      reasons.push(`打${bestOption.discard}能在维持${bestOption.shantenAfter}向听的同时保留更稳定的改良路线。`);
    }
  } else {
    reasons.push(`打${bestOption.discard}是这手唯一能兼顾向听和受入的选择。`);
  }

  if (bestWaitQuality && bestWaitQuality.ukeire > 0) {
    if (compareWaitQuality && bestWaitQuality.goodShapeRate > compareWaitQuality.goodShapeRate) {
      reasons.push(`同时它的良形率有${bestWaitQuality.goodShapeRate}%，比${compareWaitQuality.goodShapeRate}%更容易做成好形听牌。`);
    } else if (bestWaitQuality.goodShapeRate > 0) {
      reasons.push(`它的良形率为${bestWaitQuality.goodShapeRate}%，后续更容易形成两面听牌。`);
    }
  }

  return reasons.join('');
}

function buildCommonMistake(
  bestDiscard: string,
  userDiscard: string,
  structure: HandStructure,
  bestOption: EfficiencyResult,
  userOption: EfficiencyResult | undefined,
): string | undefined {
  if (userDiscard === bestDiscard) {
    return undefined;
  }

  const userComponent = findComponentDescription(structure, userDiscard);
  if (userComponent) {
    if (userComponent.includes('顺子') || userComponent.includes('刻子')) {
      return `常见错误是拆${userComponent}。这样会直接损失已有面子，使受入明显下降。`;
    }
    if (userComponent.includes('雀头')) {
      return `过早拆${userComponent}会让雀头候补变少，听牌形状也更不稳定。`;
    }
    return `拆${userComponent}会损失现成搭子，进张路线会明显变窄。`;
  }

  if (structure.isolated.includes(bestDiscard)) {
    return `这手更应该先处理${bestDiscard}这张孤立牌，避免为了表面整齐去拆掉更有连接价值的牌。`;
  }

  if (userOption && userOption.shantenAfter > bestOption.shantenAfter) {
    return `看起来顺手的${userDiscard}其实会让手牌退向听，优先保持向听数比单纯切孤张更重要。`;
  }

  return `不要只看单张是否孤立，打${userDiscard}会破坏现有组合，实际效率不如打${bestDiscard}。`;
}

function buildConcept(structure: HandStructure, bestOption: EfficiencyResult, waitQuality?: WaitQualityResult): string | undefined {
  const taatsuTypes = new Set(structure.taatsu.map((item) => item.type));
  if (taatsuTypes.has('ryanmen') && (taatsuTypes.has('kanchan') || taatsuTypes.has('penchan'))) {
    return '搭子比较：两面 > 嵌张 > 边张';
  }

  if (waitQuality && waitQuality.goodShapeRate > 0 && waitQuality.goodShapeRate < 100) {
    return '複合搭子的改良价值';
  }

  if (structure.isolated.length >= 2) {
    return '孤立牌取舍';
  }

  if (structure.jantai || structure.taatsu.some((item) => item.type === 'pair')) {
    return '雀头候补的柔软性';
  }

  if (bestOption.shantenAfter <= 1) {
    return '好形先行';
  }

  return undefined;
}

export interface GenerateExplanationOptions {
  bestDiscard: string;
  options: EfficiencyResult[] | { discard: string; shanten: number; ukeire: number | null; quality?: number | null; usefulTileCodes?: string[] }[];
  structure: HandStructure;
  tags?: string[];
  mode?: string;
  userDiscard?: string;
  waitQuality?: WaitQualityResult[];
}

export function generateExplanation(opts: GenerateExplanationOptions): ExplanationSections {
  const { bestDiscard, options: rawOptions, structure, userDiscard, waitQuality } = opts;

  const allOptions: EfficiencyResult[] = rawOptions.map((opt) => ({
    discard: opt.discard,
    shantenAfter: (opt as { shanten?: number }).shanten ?? (opt as EfficiencyResult).shantenAfter ?? 0,
    ukeire: opt.ukeire ?? 0,
    usefulTiles: (opt as EfficiencyResult).usefulTiles ?? (opt as { usefulTileCodes?: string[] }).usefulTileCodes ?? [],
  }));

  const optionMap = getOptionMap(allOptions);
  const waitQualityMap = getWaitQualityMap(waitQuality);
  const bestOption = optionMap.get(bestDiscard) ?? allOptions[0];

  if (!bestOption) {
    return {
      handStructure: structure.summary,
      bestReason: '无法分析最优打法。',
    };
  }

  const effectiveUserDiscard = userDiscard ?? bestDiscard;
  const userOption = optionMap.get(effectiveUserDiscard);
  const compareTarget = userOption && userOption.discard !== bestOption.discard
    ? userOption
    : allOptions.find((option) => option.discard !== bestOption.discard);
  const bestWaitQuality = waitQualityMap.get(bestOption.discard);
  const compareWaitQuality = compareTarget ? waitQualityMap.get(compareTarget.discard) : undefined;

  return {
    handStructure: buildHandStructureText(structure),
    bestReason: buildBestReason(bestOption, compareTarget, bestWaitQuality, compareWaitQuality),
    commonMistake: buildCommonMistake(bestDiscard, effectiveUserDiscard, structure, bestOption, userOption),
    concept: buildConcept(structure, bestOption, bestWaitQuality),
  };
}
