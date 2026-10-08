import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

import caCommon from "../messages/ca/common.json";
import caAuth from "../messages/ca/auth.json";
import caHome from "../messages/ca/home.json";
import caProjects from "../messages/ca/projects.json";
import caRecruitment from "../messages/ca/recruitment.json";
import caPropaganda from "../messages/ca/propaganda.json";
import caAtzar from "../messages/ca/atzar.json";
import caAdmin from "../messages/ca/admin.json";
import caPrivacy from "../messages/ca/privacy.json";

import esCommon from "../messages/es/common.json";
import esAuth from "../messages/es/auth.json";
import esHome from "../messages/es/home.json";
import esProjects from "../messages/es/projects.json";
import esRecruitment from "../messages/es/recruitment.json";
import esPropaganda from "../messages/es/propaganda.json";
import esAtzar from "../messages/es/atzar.json";
import esAdmin from "../messages/es/admin.json";
import esPrivacy from "../messages/es/privacy.json";

import enCommon from "../messages/en/common.json";
import enAuth from "../messages/en/auth.json";
import enHome from "../messages/en/home.json";
import enProjects from "../messages/en/projects.json";
import enRecruitment from "../messages/en/recruitment.json";
import enPropaganda from "../messages/en/propaganda.json";
import enAtzar from "../messages/en/atzar.json";
import enAdmin from "../messages/en/admin.json";
import enPrivacy from "../messages/en/privacy.json";

const messagesByLocale = {
  ca: {
    common: caCommon,
    auth: caAuth,
    home: caHome,
    projects: caProjects,
    recruitment: caRecruitment,
    propaganda: caPropaganda,
    atzar: caAtzar,
    admin: caAdmin,
    privacy: caPrivacy,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    home: esHome,
    projects: esProjects,
    recruitment: esRecruitment,
    propaganda: esPropaganda,
    atzar: esAtzar,
    admin: esAdmin,
    privacy: esPrivacy,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    home: enHome,
    projects: enProjects,
    recruitment: enRecruitment,
    propaganda: enPropaganda,
    atzar: enAtzar,
    admin: enAdmin,
    privacy: enPrivacy,
  },
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
