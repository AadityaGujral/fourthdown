export const teamBrand:Record<string,{primary:string;secondary:string}>={
ARZ:{primary:"#97233F",secondary:"#FFB612"},ATL:{primary:"#A71930",secondary:"#000000"},BAL:{primary:"#241773",secondary:"#9E7C0C"},BUF:{primary:"#00338D",secondary:"#C60C30"},
CAR:{primary:"#0085CA",secondary:"#101820"},CHI:{primary:"#0B162A",secondary:"#C83803"},CIN:{primary:"#FB4F14",secondary:"#000000"},CLE:{primary:"#311D00",secondary:"#FF3C00"},
DAL:{primary:"#003594",secondary:"#869397"},DEN:{primary:"#FB4F14",secondary:"#002244"},DET:{primary:"#0076B6",secondary:"#B0B7BC"},GB:{primary:"#203731",secondary:"#FFB612"},
HOU:{primary:"#03202F",secondary:"#A71930"},IND:{primary:"#002C5F",secondary:"#A2AAAD"},JAX:{primary:"#006778",secondary:"#D7A22A"},KC:{primary:"#E31837",secondary:"#FFB81C"},
LV:{primary:"#000000",secondary:"#A5ACAF"},LAC:{primary:"#0080C6",secondary:"#FFC20E"},LAR:{primary:"#003594",secondary:"#FFA300"},MIA:{primary:"#008E97",secondary:"#FC4C02"},
MIN:{primary:"#4F2683",secondary:"#FFC62F"},NE:{primary:"#002244",secondary:"#C60C30"},NO:{primary:"#D3BC8D",secondary:"#101820"},NYG:{primary:"#0B2265",secondary:"#A71930"},
NYJ:{primary:"#125740",secondary:"#FFFFFF"},PHI:{primary:"#004C54",secondary:"#A5ACAF"},PIT:{primary:"#FFB612",secondary:"#101820"},SF:{primary:"#AA0000",secondary:"#B3995D"},
SEA:{primary:"#002244",secondary:"#69BE28"},TB:{primary:"#D50A0A",secondary:"#FF7900"},TEN:{primary:"#0C2340",secondary:"#4B92DB"},WAS:{primary:"#5A1414",secondary:"#FFB612"}
};
export function brandFor(abbr:string){return teamBrand[abbr]||{primary:"#1a2230",secondary:"#ed2b36"}}