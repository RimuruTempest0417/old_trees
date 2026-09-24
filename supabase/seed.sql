-- 由 scripts/build_seed.py 自動產生，請勿手動編輯。
-- 匯入順序：堂區 → 物種 → 地點 → 古樹 → 路綫 → 科普 → 時間線
begin;
truncate table public.trees, public.sites, public.species, public.parishes, public.routes, public.conservation_topics, public.timeline_events restart identity cascade;

-- 堂區
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('花地瑪堂區','花地瑪堂區','Nossa Senhora de Fátima',3.2,22.21,113.548,'澳門半島北部，含青洲、台山、黑沙環、望廈');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('花王堂區','花王堂區','Santo António',1.1,22.199,113.5395,'含白鴿巢公園、沙梨頭、新橋');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('望德堂區','望德堂區','São Lázaro',0.6,22.198,113.55,'面積最小、人口密度最高的堂區之一，含盧廉若公園、塔石');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('大堂區','大堂區','Sé',1.4,22.191,113.545,'含南灣、新馬路一帶，澳門歷史城區核心');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('風順堂區','風順堂區','São Lourenço',0.9,22.188,113.533,'含媽閣、亞婆井、西灣，歷史城區西南部');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('嘉模堂區','嘉模堂區','Nossa Senhora do Carmo',7.9,22.157,113.557,'氹仔，含嘉模、龍環葡韻、小潭山');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('聖方濟各堂區','聖方濟各堂區','São Francisco Xavier',7.6,22.118,113.557,'路環，全澳古樹數量最多的堂區');
insert into public.parishes (code,name_zh,name_pt,area_km2,centroid_lat,centroid_lon,note) values ('路氹填海區','路氹填海區','Zona do Aterro Cotai',5.8,22.14,113.57,'路氹城填海區，成陸時間短，古樹極少');

-- 物種
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (1,'九里香','Murraya paniculata','Q238591','/photos/species/00.jpg','AjayDas','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Murraya_paniculata_flower.jpg','芸香科九里香属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (2,'人心果','Manilkara zapota','Q1944215','/photos/species/01.jpg','Afifa Afrin','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Manilkara_zapota_(Naseberry)_tree_in_RDA,_Bogra_05.jpg','夜蛾科阿夜蛾属昆虫');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (3,'人面子','Dracontomelon duperreanum','Q10810322','/photos/species/02.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Fruits_of_Dracontomelon_duperreanum.JPG','漆树科人面子属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (4,'假柿木薑子','Litsea monopetala','Q10888601','/photos/species/03.jpg','阿橋 HQ','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:%E5%81%87%E6%9F%BF%E6%9C%A8%E8%96%91%E5%AD%90(%E5%81%87%E6%9F%BF%E6%A8%B9)_Litsea_monopetala_-%E9%A6%99%E6%B8%AF%E6%A2%85%E6%A8%B9%E5%9D%91%E5%85%AC%E5%9C%92_Mui_Shue_Hang_Park,_Hong_Kong-_(9213305333).jpg','樟科木姜子属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (5,'假蘋婆','Sterculia lanceolata','Q10888701','/photos/species/04.jpg','Shawn O''Donnell','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Sterculia_lanceolata_15896988.jpg','锦葵科苹婆属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (6,'土蜜樹','Bridelia tomentosa','Q10927734','/photos/species/05.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Leaf_for_Bridelia_tomentosa.jpg','叶下珠科土蜜树属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (7,'山杜英','Elaeocarpus sylvestris','Q5367459','/photos/species/06.jpg','阿橋 HQ','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:%E5%B1%B1%E6%9D%9C%E8%8B%B1(%E8%86%BD%E5%85%AB%E6%A8%B9)_Elaeocarpus_sylvestris_-%E9%A6%99%E6%B8%AF%E5%A4%AA%E5%B9%B3%E5%B1%B1_Victoria_Peak,_Hong_Kong-_(9227099779).jpg','杜英科杜英属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (8,'山烏桕','Triadica cochinchinensis','Q15381277','/photos/species/07.jpg','Wikimedia Commons','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:%E5%B1%B1%E7%83%8F%E8%87%BC_Sapium_discolor_-%E9%A6%99%E6%B8%AF%E8%BF%AA%E6%AC%A3%E6%B9%96_Inspiration_Lake,_Hong_Kong-_(9222651074).jpg','大戟科乌桕属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (9,'心葉榕','Ficus rumphii','Q3071424','/photos/species/08.jpg','Raditya Nanta','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Ancak,_Ficus_rumphii_Bl.jpg','桑科榕属的一种植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (10,'木棉','Bombax ceiba','Q157756','/photos/species/09.jpg','Earth100','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Bombax_ceiba_Flower_in_Lantau_island,_Hong_Kong.JPG','锦葵科木槿属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (11,'朴樹','Celtis sinensis','Q706339','/photos/species/10.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:Celtis_sinensis%3DChinese_Hackberry.jpg','大麻科朴属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (12,'桂木','Artocarpus nitidus','Q11111499','/photos/species/11.jpg','Forest and Kim Starr','CC BY 3.0 us','https://commons.wikimedia.org/wiki/File:Starr-090709-2564-Artocarpus_nitidus_subsp_lingnanensis-habit-Lahaina-Maui_(24338741444).jpg','subspecies of plant');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (13,'桑','Morus alba','Q157307','/photos/species/12.jpg','Suyash Dwivedi','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Morus_alba_flowers_in_India.jpg','桑科桑属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (14,'楊桃','Averrhoa carambola','Q159447','/photos/species/13.jpg','Mailamal','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Averrhoa_carambola_Fruit.JPG','陽桃科陽桃屬植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (15,'榔榆','Ulmus parvifolia','Q1074099','/photos/species/14.jpg','Photo by and (c)2014 Derek Ramsey (Ram-Man)','GFDL 1.2','https://commons.wikimedia.org/wiki/File:Chinese_Elm_Ulmus_parvifolia_(32-0052-A)_Bark_2.JPG','榆科榆属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (16,'榕樹','Ficus microcarpa','Q714180','/photos/species/15.jpg','H. Zell','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Ficus_microcarpa_-_La_Gomera_01.jpg','桑科榕属的一种植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (17,'樟樹','Cinnamomum camphora','Q158722','/photos/species/16.jpg','John Robert McPherson','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Cinnamomum_camphora_flowers,_Downfall_Creek_Parkland_Wavell_Heights_01.jpg','樟科肉桂属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (18,'橄欖','Canarium album','Q1621080','/photos/species/17.jpg','さつまやまいもすけ','CC0','https://commons.wikimedia.org/wiki/File:The_tree_of_Canarium_album.jpg','橄欖樹之果實');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (19,'水翁','Syzygium nervosum','Q7663992','/photos/species/18.jpg','Ajtjohnsingh','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Syzygium_operculatum_,_AJT_Johnsingh._P1100829.jpg','桃金娘科蒲桃属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (20,'洋蒲桃','Syzygium samarangense','Q11643111','/photos/species/19.jpg','Salil Kumar Mukherjee','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Wax_apple_(Syzygium_samarangense)_with_leaves.jpg','桃金娘科蒲桃属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (21,'海南蒲桃','Syzygium hainanense','Q232571','/photos/species/20.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Syzygium_cumini_plant.jpg','桃金娘科蒲桃属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (22,'潺槁樹','Litsea glutinosa','Q10743709','/photos/species/21.jpg','Francisco Manuel Blanco (O.S.A.)','Public domain','https://commons.wikimedia.org/wiki/File:Lauraceae_sp_Blanco2.360.png','樟科木姜子属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (23,'烏桕','Triadica sebifera','Q702175','/photos/species/22.jpg','KENPEI','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Triadica_sebifera1.jpg','大戟科乌桕属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (24,'無患子','Sapindus mukorossi','Q2672802','/photos/species/23.jpg','Adolphus Ypey','Public domain','https://commons.wikimedia.org/wiki/File:Sapindus_saponaria_Ypey38,_cleaned.jpg','无患子科无患子属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (25,'白桂木','Artocarpus hypargyreus','Q3761174','/photos/species/24.jpg','Wikimedia Commons','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Artocarpus_hypargyreus_Hance_ex_Benth._(AM_AK355615).jpg','桑科波罗蜜属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (26,'白蘭','Michelia alba','Q2221893','/photos/species/25.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Michelia_alba_(Campii).jpg','木兰科木兰属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (27,'石斑木','Rhaphiolepis indica','Q3205640','/photos/species/26.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Indian_Hawthorn,_India_Hawthorn_(Rhaphiolepis_indica).jpg','蔷薇科石斑木属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (28,'石栗','Aleurites moluccanus','Q1160961','/photos/species/27.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:Starr_020803-0119_Aleurites_moluccana.jpg','大戟科石栗属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (29,'破布木','Cordia dichotoma','Q3645945','/photos/species/28.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:Cordia_dichotoma_(Lasora)_in_Hyderabad_W_IMG_7089.jpg','紫草科破布木属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (30,'米仔蘭','Aglaia odorata','Q2674471','/photos/species/29.jpg','Taken by','CC BY 2.5','https://commons.wikimedia.org/wiki/File:AglaiaOdorata2.jpg','楝科樹蘭屬常綠灌木');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (31,'紅膠木','Lophostemon confertus','Q1002860','/photos/species/30.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Lophostemon_confertus_Pengo.jpg','桃金娘科红胶木属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (32,'紅雞蛋花','Plumeria rubra','Q1097328','/photos/species/31.jpg','Wikimedia Commons','CC BY 2.0','https://commons.wikimedia.org/wiki/File:Plumeria-wiki-Zachi-Evenor-001a.jpg','夹竹桃科缅栀属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (33,'紫薇','Lagerstroemia indica','Q1148692','/photos/species/32.jpg','Gabriel Collares','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Extremosa_(Lagerstroemia_indica)_em_um_fim_de_tarde_em_Bag%C3%A9-RS.jpg','千屈菜科紫薇属落叶乔木');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (34,'羅漢松','Podocarpus macrophyllus','Q165063','/photos/species/33.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Podocarpus_macrophyllus.jpg','罗汉松科罗汉松属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (35,'翅子樹','Pterospermum acerifolium','Q10914961','/photos/species/34.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:Kanak_Champa_(Pterospermum_acerifolium)_in_Hyderabad_W_IMG_7126.jpg','species of plant');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (36,'翻白葉樹','Pterospermum heterophyllum',NULL,NULL,NULL,NULL,NULL,NULL);
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (37,'芒果','Mangifera indica','Q3919027','/photos/species/36.jpg','Wikimedia Commons','Public domain','https://commons.wikimedia.org/wiki/File:The_Botanical_Magazine._Mango.jpg','漆树科杧果属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (38,'荔枝','Litchi chinensis','Q13182','/photos/species/37.jpg','Wikimedia Commons','CC BY 3.0 us','https://commons.wikimedia.org/wiki/File:Starr-090617-0938-Litchi_chinensis-fruiting_habit-Haiku-Maui_(41353189901).jpg','无患子科荔枝属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (39,'菠蘿蜜','Artocarpus heterophyllus','Q45757','/photos/species/38.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:The_jackfruit_is_holding_on_to_the_tree.jpg','桑科波罗蜜属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (40,'華潤楠','Machilus chinensis','Q10905819','/photos/species/39.jpg','Wikimedia Commons','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:%E8%8F%AF%E6%BD%A4%E6%A5%A0_Machilus_chinensis_-%E9%A6%99%E6%B8%AF%E8%8A%B1%E5%B1%95_Hong_Kong_Flower_Show-_(25661783130).jpg','樟科润楠属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (41,'蘋婆','Sterculia monosperma','Q4923879','/photos/species/40.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Sterculia_monosperma130.JPG','锦葵科苹婆属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (42,'赤桉','Eucalyptus camaldulensis','Q162822','/photos/species/41.jpg','Wikimedia Commons','GFDL 1.2','https://commons.wikimedia.org/wiki/File:700_yr_red_river_gum.jpg','桃金娘科桉属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (43,'銀柴','Aporosa dioica','Q28819051','/photos/species/42.jpg','Wikimedia Commons','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:%E9%8A%80%E6%9F%B4(%E5%A4%A7%E6%B2%99%E8%91%89)-%E9%9B%8C%E8%8A%B1_Aporusa_dioica_-%E9%A6%99%E6%B8%AF%E9%A6%AC%E7%81%A3%E5%85%AC%E5%9C%92_Ma_Wan_Park,_Hong_Kong-_(9216098892).jpg','大戟科银柴属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (44,'鐵冬青','Ilex rotunda','Q844306','/photos/species/43.jpg','カールおじさん','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:W_kuroganemoti3101.jpg','冬青科冬青属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (45,'鐵刀木','Senna siamea','Q36154','/photos/species/44.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kassod_(Senna_siamea)_flowers_W_IMG_0540.jpg','豆科決明屬植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (46,'闊葉合歡','Albizia lebbeck','Q105236620','/photos/species/45.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Albizia_lebbeck_MHNT.BOT.2015.2.45.jpg','chemical compound');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (47,'雞蛋花','Plumeria rubra','Q218123','/photos/species/46.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Frangipani_flowers.jpg','夹竹桃科的一属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (48,'青果榕','Ficus variegata','Q15474540','/photos/species/47.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Ficus_chrysocarpa_Da_nhong_vang.JPG','桑科榕属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (49,'餘甘子','Phyllanthus emblica','Q310050','/photos/species/48.jpg','L. Shyamal','CC BY 2.5','https://commons.wikimedia.org/wiki/File:Phyllanthus_officinalis.jpg','叶下珠科叶下珠属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (50,'馬尾松','Pinus massoniana','Q716571','/photos/species/49.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Pinus_massoniana_2.jpg','松科松属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (51,'高山榕','Ficus altissima','Q4921039','/photos/species/50.jpg','KENPEI','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Ficus_altissima1.jpg','桑科榕属的一种植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (52,'鳳凰木','Delonix regia','Q238486','/photos/species/51.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Royal_Poinciana.jpg','苏木科凤凰木属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (53,'鴨腳木','Schefflera octophylla','Q134943','/photos/species/52.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:%E6%B1%9F%E6%9F%90.JPG','五加科南鹅掌柴属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (54,'黃槿','Talipariti tiliaceum','Q15768656','/photos/species/53.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Fleur_de_p%C5%ABrau_(hibiscus_tiliaceus).jpg','锦葵科木槿属的一种植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (55,'黃蘭','Michelia champaca','Q162001','/photos/species/54.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Cephalanthera_longifolia_plant100604.jpg','兰科的一属植物');
insert into public.species (id,name_zh,name_sci,wikidata_id,photo_url,photo_credit,photo_license,photo_page,description) values (56,'龍眼','Dimocarpus longan','Q193449','/photos/species/55.jpg','Wikimedia Commons','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:C%C3%A2y_nh%C3%A3n.jpg','無患子科， 龍眼屬的一種植物');

-- 地點
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (1,'氹仔區兵房斜巷6號','兵房斜巷6號','嘉模堂區',22.153139,113.55777,'exact','nominatim','/photos/sites/001.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Beco_do_Ferreiro_12-02-2025(2).jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (2,'氹仔區史劉蓮德博士眺望台（十字花園）','史劉蓮德博士眺望台','嘉模堂區',22.153391,113.558974,'exact','nominatim','/photos/sites/002.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Miradouro_da_Dra._Laurinda_M._Esparteiro_01-02-2025(3).jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (3,'氹仔區嘉模斜巷','嘉模斜巷','嘉模堂區',22.153932,113.558747,'exact','nominatim','/photos/sites/003.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:%E5%98%89%E6%A8%A1%E6%96%9C%E5%B7%B7_Calcada_do_Carmo_-_panoramio.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (4,'氹仔區嘉路士米耶馬路','嘉路士米耶馬路','嘉模堂區',22.153226,113.558242,'exact','nominatim','/photos/sites/004.jpg','Wikimedia Commons','CC BY 3.0','https://commons.wikimedia.org/wiki/File:%E5%98%89%E8%B7%AF%E5%A3%AB%E7%B1%B3%E8%80%B6%E9%A6%AC%E8%B7%AF_Avenida_de_Carlos_da_Maia_-_panoramio.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (5,'氹仔區天津街','天津街','嘉模堂區',22.162535,113.55802,'exact','nominatim','/photos/sites/005.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Cl%C3%ADnica_Psiqui%C3%A1trica_do_Centro_Hospitalar_Conde_de_S%C3%A3o_Janu%C3%A1rio.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (6,'氹仔區好利安製藥科學股份有限公司','好利安製藥科學股份有限公司','嘉模堂區',22.156,113.56,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (7,'氹仔區小潭山2000環山徑','小潭山2000環山徑','嘉模堂區',22.1605,113.5545,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (8,'氹仔區巴波沙總督前地','巴波沙總督前地','嘉模堂區',22.15216,113.555303,'exact','nominatim','/photos/sites/006.jpg','Wikimedia Commons','CC0','https://commons.wikimedia.org/wiki/File:MC_Macau_%E6%B0%B9%E4%BB%94_Taipa_%E5%9C%B0%E5%A0%A1%E8%A1%97_Rua_do_Regedor_old_town_night_November_2023_R12S_27.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (9,'氹仔區巴波沙總督街','巴波沙總督街','嘉模堂區',22.151736,113.555543,'exact','nominatim','/photos/sites/007.jpg','Wikimedia Commons','CC0','https://commons.wikimedia.org/wiki/File:MC_Macau_%E6%B0%B9%E4%BB%94_Taipa_town_city_tour_March_2025_R12S_53.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (10,'氹仔區徐日昇寅公圓形地','徐日昇寅公圓形地','嘉模堂區',22.162291,113.559538,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (11,'氹仔區徐日昇寅公馬路','徐日昇寅公馬路','嘉模堂區',22.164607,113.558394,'exact','nominatim','/photos/sites/009.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:20250812_Edif%C3%ADcio_Yiu_Tung.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (12,'氹仔區氹仔嘉模市政墳場','氹仔嘉模市政墳場','嘉模堂區',22.158224,113.561877,'exact','nominatim','/photos/sites/010.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Taipa_Grande_Viewing_Platform_20-11-2023.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (13,'氹仔區氹仔東北馬路','氹仔東北馬路','嘉模堂區',22.162599,113.56015,'exact','nominatim','/photos/sites/011.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:20260425_Centro_Desportivo_do_Nordeste_da_Taipa.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (14,'氹仔區氹仔沙崗市政墳場','氹仔沙崗市政墳場','嘉模堂區',22.162069,113.562376,'exact','nominatim','/photos/sites/012.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Est._Alm._M._Correia_bus_stop_13-03-2024.jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (15,'氹仔區海灣巷','海灣巷','嘉模堂區',22.162157,113.559927,'exact','nominatim','/photos/sites/013.jpg','Wikimedia Commons','CC BY-SA 2.0','https://commons.wikimedia.org/wiki/File:Swarovski_(14566675209).jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (16,'氹仔區澳門童軍總會總部','澳門童軍總會總部','嘉模堂區',22.157169,113.54239,'exact','nominatim','/photos/sites/014.jpg','Wikimedia Commons','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Associa%C3%A7%C3%A3o_de_Escoteiros_de_Macau_headquarters_13-09-2023(2).jpg');
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (17,'氹仔區益隆炮竹廠','益隆炮竹廠','嘉模堂區',22.1552,113.5575,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (18,'氹仔區素啤古街','素啤古街','嘉模堂區',22.154769,113.559605,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (19,'氹仔區菜園路','菜園路','嘉模堂區',22.160533,113.558548,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (20,'氹仔區關帝殿及天后宮','關帝殿及天后宮','嘉模堂區',22.1545,113.5565,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (21,'氹仔區飛能便度街','飛能便度街','嘉模堂區',22.203386,113.545509,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (22,'氹仔區高勵雅馬路','高勵雅馬路','嘉模堂區',22.160658,113.561792,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (23,'澳門區主教山小堂','主教山小堂','風順堂區',22.186847,113.535029,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (24,'澳門區主教山眺望台','主教山眺望台','風順堂區',22.187063,113.534578,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (25,'澳門區二龍喉公園','二龍喉公園','望德堂區',22.200111,113.551427,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (26,'澳門區亞婆井前地','亞婆井前地','風順堂區',22.18837,113.535195,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (27,'澳門區亞婆井圍','亞婆井圍','風順堂區',22.188067,113.534676,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (28,'澳門區亞婆井街1號/亞婆井前地27號','亞婆井街1號/亞婆井前地27號','風順堂區',22.1879,113.5378,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (29,'澳門區仁慈堂婆仔屋','仁慈堂婆仔屋','望德堂區',22.197527,113.544573,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (30,'澳門區何東圖書館','何東圖書館','風順堂區',22.192504,113.53766,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (31,'澳門區何賢公園','何賢公園','大堂區',22.192728,113.549094,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (32,'澳門區何賢紳士大馬路','何賢紳士大馬路','花地瑪堂區',22.213463,113.542899,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (33,'澳門區俾利喇街153號','俾利喇街153號','花地瑪堂區',22.206774,113.550366,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (34,'澳門區兵營斜巷','兵營斜巷','大堂區',22.192313,113.544841,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (35,'澳門區加思欄後新馬路','加思欄後新馬路','大堂區',22.192542,113.545298,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (36,'澳門區加思欄花園','加思欄花園','大堂區',22.192488,113.544641,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (37,'澳門區啟智學校','啟智學校','望德堂區',22.195562,113.551004,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (38,'澳門區土地廟','土地廟','花王堂區',22.201951,113.539813,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (39,'澳門區士多鳥拜斯大馬路','士多鳥拜斯大馬路','望德堂區',22.200045,113.549629,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (40,'澳門區大炮台公園','大炮台公園','花王堂區',22.19699,113.541965,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (41,'澳門區天后古廟','天后古廟','花地瑪堂區',22.115276,113.551875,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (42,'澳門區媽祖閣（媽祖廟）','媽祖閣','風順堂區',22.186109,113.531267,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (43,'澳門區媽閣上街','媽閣上街','風順堂區',22.183896,113.530845,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (44,'澳門區媽閣廟前地','媽閣廟前地','風順堂區',22.18647,113.530806,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (45,'澳門區媽閣斜巷','媽閣斜巷','風順堂區',22.187265,113.532219,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (46,'澳門區家辣堂街','家辣堂街','大堂區',22.193054,113.543797,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (47,'澳門區岡頂前地','岡頂前地','風順堂區',22.192153,113.538086,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (48,'澳門區崗頂劇院','崗頂劇院','風順堂區',22.191912,113.538206,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (49,'澳門區庇道學校','庇道學校','花王堂區',22.204207,113.549033,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (50,'澳門區新勝街','新勝街','花王堂區',22.198671,113.541077,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (51,'澳門區新花園泳池','新花園泳池','望德堂區',22.19748,113.547749,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (52,'澳門區普濟禪院（觀音堂）','普濟禪院','花地瑪堂區',22.204399,113.550434,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (53,'澳門區望廈山市政公園','望廈山市政公園','花地瑪堂區',22.207782,113.547799,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (54,'澳門區望廈聖方濟各聖堂','望廈聖方濟各聖堂','花王堂區',22.204498,113.549248,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (55,'澳門區杜南眺望台','杜南眺望台','風順堂區',22.181523,113.531607,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (56,'澳門區東望洋街','東望洋街','望德堂區',22.195845,113.545423,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (57,'澳門區松山市政公園','松山市政公園','望德堂區',22.198344,113.551707,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (58,'澳門區民國大馬路','民國大馬路','風順堂區',22.186147,113.537224,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (59,'澳門區治安警察局交通廳','治安警察局交通廳','望德堂區',22.19938,113.549435,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (60,'澳門區海景花園休憩區','海景花園休憩區','大堂區',22.192511,113.552293,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (61,'澳門區海邊馬路','海邊馬路','望德堂區',22.153889,113.559869,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (62,'澳門區澳門伊斯蘭清真寺及墳場','澳門伊斯蘭清真寺及墳場','花地瑪堂區',22.202796,113.554612,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (63,'澳門區澳門保安部隊事務局','澳門保安部隊事務局','大堂區',22.191832,113.544952,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (64,'澳門區澳門博物館','澳門博物館','花王堂區',22.197153,113.542154,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (65,'澳門區澳門基督教聖堂及墳場','澳門基督教聖堂及墳場','花王堂區',22.1968,113.548,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (66,'澳門區澳門市政狗房','澳門市政狗房','花地瑪堂區',22.207403,113.546366,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (67,'澳門區白頭墳場','白頭墳場','大堂區',22.195212,113.548774,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (68,'澳門區白鴿巢公園','白鴿巢公園','花王堂區',22.200755,113.539215,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (69,'澳門區盧廉若公園','盧廉若公園','望德堂區',22.200487,113.547948,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (70,'澳門區竹室正街休憩區','竹室正街休憩區','風順堂區',22.187187,113.535833,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (71,'澳門區粵華中學','粵華中學','望德堂區',22.196907,113.548205,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (72,'澳門區罅些喇提督大馬路','罅些喇提督大馬路','花地瑪堂區',22.207772,113.546148,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (73,'澳門區美珊枝街','美珊枝街','望德堂區',22.197706,113.544163,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (74,'澳門區聖公會聖馬可堂','聖公會聖馬可堂','大堂區',22.195272,113.543987,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (75,'澳門區聖地牙哥酒店','聖地牙哥酒店','風順堂區',22.182667,113.530689,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (76,'澳門區聖若瑟修院','聖若瑟修院','風順堂區',22.1872,113.5412,'approx','manual-checked',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (77,'澳門區聖若瑟教區中學','聖若瑟教區中學','大堂區',22.211858,113.545846,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (78,'澳門區肥利喇亞美打大馬路','肥利喇亞美打大馬路','望德堂區',22.202803,113.550325,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (79,'澳門區茨林圍','茨林圍','花王堂區',22.198183,113.540728,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (80,'澳門區蓮峯廟','蓮峯廟','花地瑪堂區',22.209874,113.547719,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (81,'澳門區蓮峰街','蓮峰街','花地瑪堂區',22.209227,113.548308,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (82,'澳門區蓮花巷','蓮花巷','花地瑪堂區',22.211214,113.542044,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (83,'澳門區螺絲山公園','螺絲山公園','花地瑪堂區',22.204295,113.55253,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (84,'澳門區西墳馬路','西墳馬路','望德堂區',22.198007,113.54546,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (85,'澳門區觀音古廟','觀音古廟','花地瑪堂區',22.206139,113.547737,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (86,'澳門區鄭家大屋','鄭家大屋','風順堂區',22.188587,113.534413,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (87,'澳門區鏡湖醫院','鏡湖醫院','望德堂區',22.199139,113.542638,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (88,'澳門區青洲山','青洲山','花地瑪堂區',22.21143,113.537638,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (89,'澳門區風順堂街','風順堂街','風順堂區',22.190401,113.536512,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (90,'澳門區馬交石炮台馬路','馬交石炮台馬路','花地瑪堂區',22.203321,113.553643,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (91,'澳門區高園街','高園街','花王堂區',22.198035,113.541084,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (92,'澳門區高美士中葡中學','高美士中葡中學','望德堂區',22.198286,113.548321,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (93,'路氹填海區海濱圓形地','海濱圓形地','路氹填海區',22.139708,113.552516,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (94,'路氹填海區蓮花路','蓮花路','路氹填海區',22.138405,113.565588,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (95,'路環區九澳村路','九澳村路','聖方濟各堂區',22.149929,113.589361,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (96,'路環區九澳聖母馬路','九澳聖母馬路','聖方濟各堂區',22.134713,113.581482,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (97,'路環區十月初五馬路','十月初五馬路','聖方濟各堂區',22.115144,113.550388,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (98,'路環區恩尼斯總統前地','恩尼斯總統前地','聖方濟各堂區',22.117992,113.551716,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (99,'路環區戴紳禮街','戴紳禮街','聖方濟各堂區',22.118111,113.551415,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (100,'路環區打纜街','打纜街','聖方濟各堂區',22.117192,113.552431,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (101,'路環區民國馬路','民國馬路','聖方濟各堂區',22.115298,113.551406,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (102,'路環區海事及水務局','海事及水務局','聖方濟各堂區',22.187902,113.533167,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (103,'路環區海關','海關','聖方濟各堂區',22.119538,113.54995,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (104,'路環區澳門保安部隊高等學校','澳門保安部隊高等學校','聖方濟各堂區',22.119577,113.551825,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (105,'路環區田畔街','田畔街','聖方濟各堂區',22.200773,113.541784,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (106,'路環區登峰路','登峰路','聖方濟各堂區',22.115687,113.552782,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (107,'路環區石排灣郊野公園','石排灣郊野公園','聖方濟各堂區',22.126785,113.558842,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (108,'路環區石排灣馬路','石排灣馬路','聖方濟各堂區',22.131542,113.560237,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (109,'路環區石街','石街','聖方濟各堂區',22.2019,113.540129,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (110,'路環區竹灣馬路','竹灣馬路','聖方濟各堂區',22.114397,113.560713,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (111,'路環區聖方濟各街','聖方濟各街','聖方濟各堂區',22.119685,113.555708,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (112,'路環區船人街','船人街','聖方濟各堂區',22.118878,113.550569,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (113,'路環區船鋪前地','船鋪前地','聖方濟各堂區',22.115785,113.55094,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (114,'路環區船鋪街','船鋪街','聖方濟各堂區',22.115147,113.550874,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (115,'路環區荔枝碗馬路','荔枝碗馬路','聖方濟各堂區',22.121894,113.552874,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (116,'路環區譚公廟前地','譚公廟前地','聖方濟各堂區',22.114431,113.550245,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (117,'路環區路環市政狗房','路環市政狗房','聖方濟各堂區',22.115937,113.556716,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (118,'路環區路環步行','路環步行','聖方濟各堂區',22.121922,113.558763,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (119,'路環區鄉村馬路','鄉村馬路','聖方濟各堂區',22.113339,113.550851,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (120,'路環區金像農場','金像農場','聖方濟各堂區',22.115269,113.55665,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (121,'路環區飛鷹培訓基地','飛鷹培訓基地','聖方濟各堂區',22.117438,113.552733,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (122,'路環區馬忌士前地','馬忌士前地','聖方濟各堂區',22.116998,113.551104,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (123,'路環區鮑思高青年村','鮑思高青年村','聖方濟各堂區',22.134353,113.582245,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (124,'路環區黑沙村','黑沙村','聖方濟各堂區',22.119152,113.566692,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (125,'路環區黑沙水庫健康徑','黑沙水庫健康徑','聖方濟各堂區',22.126279,113.570567,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (126,'路環區黑沙海灘公園','黑沙海灘公園','聖方濟各堂區',22.12131,113.570571,'exact','nominatim',NULL,NULL,NULL,NULL);
insert into public.sites (id,name_zh,short_name,parish_code,lat,lon,geo_precision,geo_source,photo_url,photo_credit,photo_license,photo_page) values (127,'路環區黑沙臨時綠化休憩空間','黑沙臨時綠化休憩空間','聖方濟各堂區',22.113,113.562,'approx','manual-checked',NULL,NULL,NULL,NULL);

-- 古樹
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('544',21,85,'花地瑪堂區','一級',515,12.0,'瀕危',22.206274,113.547737),
('543',21,85,'花地瑪堂區','二級',495,13.0,'瀕危',22.205863,113.54801),
('439',21,68,'花王堂區','二級',365,11.0,'一般',22.20089,113.539215),
('323',17,57,'望德堂區','二級',335,14.0,'瀕危',22.198479,113.551707),
('756',17,62,'花地瑪堂區','二級',315,18.0,'一般',22.202931,113.554612),
('531',56,69,'望德堂區','二級',315,5.0,'瀕危',22.200622,113.547948),
('981',13,75,'風順堂區','二級',315,4.0,'瀕危',22.182802,113.530689),
('467',14,68,'花王堂區','三級',295,12.0,'一般',22.200644,113.539325),
('542',47,85,'花地瑪堂區','三級',295,6.0,'健康',22.206193,113.547077),
('978',17,75,'風順堂區','三級',265,15.0,'一般',22.182391,113.530962),
('752',17,17,'嘉模堂區','三級',265,15.0,'一般',22.155335,113.5575),
('814',34,67,'大堂區','三級',265,13.0,'一般',22.195212,113.548774),
('935',56,19,'嘉模堂區','三級',265,13.0,'一般',22.160668,113.558548),
('980',17,75,'風順堂區','三級',265,12.0,'一般',22.182721,113.530029),
('456',21,68,'花王堂區','三級',265,11.0,'一般',22.20077,113.539036),
('366',11,23,'風順堂區','三級',265,15.0,'健康',22.186982,113.535029),
('825',14,36,'大堂區','三級',265,9.0,'健康',22.192623,113.544641),
('813',16,41,'花地瑪堂區','三級',265,6.0,'瀕危',22.115276,113.551875),
('819',17,46,'大堂區','三級',245,13.0,'一般',22.193189,113.543797),
('228',36,88,'花地瑪堂區','三級',235,28.0,'一般',22.211565,113.537638),
('483',10,68,'花王堂區','三級',235,26.0,'一般',22.200935,113.539092),
('528',10,69,'望德堂區','三級',235,26.0,'一般',22.200358,113.548075),
('537',17,78,'望德堂區','三級',235,16.0,'一般',22.202938,113.550325),
('762',34,62,'花地瑪堂區','三級',235,13.0,'一般',22.20252,113.554885),
('454',21,68,'花王堂區','三級',235,11.0,'一般',22.200561,113.539178),
('443',29,68,'花王堂區','三級',235,22.0,'健康',22.200866,113.539371),
('824',16,36,'大堂區','三級',215,25.0,'一般',22.192351,113.544777),
('359',17,57,'望德堂區','三級',215,24.0,'一般',22.19836,113.551509),
('717',51,52,'花地瑪堂區','三級',215,13.0,'一般',22.204534,113.550434),
('816',17,29,'望德堂區','三級',215,13.0,'一般',22.197662,113.544573),
('817',17,29,'望德堂區','三級',215,13.0,'一般',22.196898,113.545196),
('23',39,95,'聖方濟各堂區','三級',215,13.0,'一般',22.150064,113.589361),
('356',21,57,'望德堂區','三級',215,12.0,'一般',22.198226,113.551823),
('884',56,30,'風順堂區','三級',215,10.0,'一般',22.192639,113.53766),
('939',56,19,'嘉模堂區','三級',215,10.0,'一般',22.160554,113.558293),
('937',56,19,'嘉模堂區','三級',215,8.0,'一般',22.160396,113.558684),
('1103',56,79,'花王堂區','三級',215,7.5,'一般',22.198183,113.540728),
('50',40,125,'聖方濟各堂區','三級',215,17.0,'健康',22.126279,113.570567),
('218',36,88,'花地瑪堂區','三級',195,28.0,'一般',22.211311,113.537756),
('224',36,88,'花地瑪堂區','三級',195,19.0,'一般',22.211446,113.537436),
('248',21,88,'花地瑪堂區','三級',195,18.0,'一般',22.211561,113.537822),
('485',51,68,'花王堂區','三級',195,16.0,'一般',22.200878,113.53893),
('536',17,78,'望德堂區','三級',195,16.0,'一般',22.202439,113.550685),
('450',21,68,'花王堂區','三級',195,15.0,'一般',22.200999,113.539311),
('912',16,110,'聖方濟各堂區','三級',195,15.0,'一般',22.114532,113.560713),
('449',21,68,'花王堂區','三級',195,14.0,'一般',22.200642,113.538981),
('932',56,19,'嘉模堂區','三級',195,13.0,'一般',22.160709,113.558795),
('295',35,57,'望德堂區','三級',195,10.0,'一般',22.198471,113.551886),
('455',21,68,'花王堂區','三級',195,10.0,'一般',22.2005,113.539328),
('432',34,68,'花王堂區','三級',195,10.0,'健康',22.200696,113.539453),
('820',1,36,'大堂區','三級',195,4.5,'健康',22.192509,113.544386),
('891',16,89,'風順堂區','三級',175,22.0,'一般',22.190401,113.536512),
('828',37,36,'大堂區','三級',175,20.0,'一般',22.192664,113.544888),
('812',10,82,'花地瑪堂區','三級',175,18.0,'一般',22.211214,113.542044),
('704',16,64,'花王堂區','三級',175,15.0,'一般',22.197288,113.542154),
('885',11,30,'風順堂區','三級',175,15.0,'一般',22.192316,113.537846),
('466',4,68,'花王堂區','三級',175,14.0,'一般',22.200847,113.539531),
('839',21,36,'大堂區','三級',175,13.0,'一般',22.192153,113.544577),
('938',56,19,'嘉模堂區','三級',175,10.0,'一般',22.160198,113.558484),
('538',17,78,'望德堂區','三級',175,8.0,'一般',22.202878,113.549407),
('908',16,40,'花王堂區','三級',175,22.0,'健康',22.197125,113.541965),
('516',16,69,'望德堂區','三級',165,23.0,'一般',22.200506,113.547717),
('204',56,88,'花地瑪堂區','三級',165,22.0,'一般',22.211656,113.537483),
('297',51,37,'望德堂區','三級',165,22.0,'一般',22.195697,113.551004),
('326',51,57,'望德堂區','三級',165,20.0,'一般',22.198562,113.551557),
('781',23,25,'望德堂區','三級',165,19.0,'一般',22.200246,113.551427),
('312',51,57,'望德堂區','三級',165,17.0,'一般',22.198114,113.551663),
('462',21,68,'花王堂區','三級',165,17.0,'一般',22.200476,113.539041),
('478',17,68,'花王堂區','三級',165,16.0,'一般',22.200552,113.539527),
('1108',41,54,'花王堂區','三級',165,13.0,'一般',22.204498,113.549248),
('474',16,68,'花王堂區','三級',165,11.0,'一般',22.201085,113.539137),
('496',47,65,'花王堂區','三級',165,9.0,'一般',22.196669,113.548129),
('495',47,65,'花王堂區','三級',165,8.0,'一般',22.196935,113.548),
('956',10,42,'風順堂區','三級',165,25.0,'健康',22.186244,113.531267),
('888',16,48,'風順堂區','三級',165,21.0,'健康',22.191912,113.538206),
('199',56,88,'花地瑪堂區','三級',165,16.7,'健康',22.211192,113.537593),
('1114',56,27,'風順堂區','三級',165,15.0,'健康',22.188202,113.534676),
('946',21,11,'嘉模堂區','三級',165,14.0,'健康',22.164742,113.558394),
('368',11,23,'風順堂區','三級',165,13.0,'健康',22.186659,113.535215),
('499',56,65,'花王堂區','三級',165,11.0,'健康',22.196501,113.547943),
('497',47,65,'花王堂區','三級',165,9.0,'健康',22.196819,113.547764),
('498',47,65,'花王堂區','三級',165,9.0,'健康',22.196959,113.548224),
('505',47,65,'花王堂區','三級',165,9.0,'健康',22.197036,113.547455),
('510',47,65,'花王堂區','三級',165,9.0,'健康',22.196245,113.547652),
('500',47,65,'花王堂區','三級',165,8.0,'健康',22.197092,113.547799),
('502',47,65,'花王堂區','三級',165,8.0,'健康',22.196602,113.547587),
('503',47,65,'花王堂區','三級',165,8.0,'健康',22.197244,113.548175),
('504',47,65,'花王堂區','三級',165,8.0,'健康',22.196324,113.548212),
('509',47,65,'花王堂區','三級',165,8.0,'健康',22.196979,113.548618),
('501',47,65,'花王堂區','三級',165,6.0,'健康',22.196699,113.548405),
('633',11,20,'嘉模堂區','三級',165,13.0,'瀕危',22.154635,113.5565),
('200',21,88,'花地瑪堂區','三級',155,28.0,'一般',22.211354,113.537945),
('287',4,57,'望德堂區','三級',155,15.0,'一般',22.19827,113.552003),
('619',9,9,'嘉模堂區','三級',155,15.0,'一般',22.151871,113.555543),
('1062',16,102,'聖方濟各堂區','三級',155,15.0,'一般',22.188037,113.533167),
('24',56,95,'聖方濟各堂區','三級',155,12.0,'一般',22.149565,113.589721),
('493',48,65,'花王堂區','三級',155,17.0,'健康',22.197468,113.547841),
('46',17,126,'聖方濟各堂區','三級',155,17.0,'健康',22.121445,113.570571),
('451',4,68,'花王堂區','三級',155,2.0,'瀕危',22.200708,113.53882),
('346',50,57,'望德堂區','三級',145,26.0,'一般',22.198202,113.551412);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('901',17,84,'望德堂區','三級',145,19.0,'一般',22.198007,113.54546),
('631',9,20,'嘉模堂區','三級',145,18.0,'一般',22.154224,113.556773),
('632',9,20,'嘉模堂區','三級',145,18.0,'一般',22.154554,113.55584),
('548',16,4,'嘉模堂區','三級',145,16.0,'一般',22.153361,113.558242),
('699',16,107,'聖方濟各堂區','三級',145,16.0,'一般',22.12692,113.558842),
('556',9,3,'嘉模堂區','三級',145,15.0,'一般',22.153986,113.558087),
('597',9,21,'嘉模堂區','三級',145,15.0,'一般',22.203521,113.545509),
('598',9,21,'嘉模堂區','三級',145,15.0,'一般',22.203198,113.545695),
('600',9,21,'嘉模堂區','三級',145,15.0,'一般',22.203419,113.545106),
('602',9,21,'嘉模堂區','三級',145,15.0,'一般',22.203687,113.545932),
('603',9,21,'嘉模堂區','三級',145,15.0,'一般',22.202782,113.545394),
('607',9,8,'嘉模堂區','三級',145,15.0,'一般',22.152295,113.555303),
('618',9,9,'嘉模堂區','三級',145,15.0,'一般',22.151758,113.555269),
('475',4,68,'花王堂區','三級',145,14.0,'一般',22.20105,113.538898),
('617',9,9,'嘉模堂區','三級',145,14.0,'一般',22.151592,113.555685),
('886',9,76,'風順堂區','三級',145,14.0,'一般',22.187335,113.5412),
('555',9,3,'嘉模堂區','三級',145,13.0,'一般',22.153656,113.55902),
('613',9,8,'嘉模堂區','三級',145,13.0,'一般',22.152002,113.55546),
('620',9,9,'嘉模堂區','三級',145,13.0,'一般',22.151927,113.555812),
('621',9,9,'嘉模堂區','三級',145,13.0,'一般',22.151367,113.555473),
('626',9,9,'嘉模堂區','三級',145,13.0,'一般',22.152102,113.555291),
('605',9,21,'嘉模堂區','三級',145,12.0,'一般',22.204005,113.545084),
('614',9,8,'嘉模堂區','三級',145,11.0,'一般',22.152186,113.554986),
('664',10,93,'路氹填海區','三級',145,7.01,'一般',22.139843,113.552516),
('877',16,47,'風順堂區','三級',145,24.0,'健康',22.192153,113.538086),
('494',10,65,'花王堂區','三級',145,24.0,'健康',22.196382,113.548642),
('910',9,96,'聖方濟各堂區','三級',145,24.0,'健康',22.134848,113.581482),
('911',9,96,'聖方濟各堂區','三級',145,24.0,'健康',22.134565,113.581628),
('445',16,68,'花王堂區','三級',145,18.0,'健康',22.200355,113.539233),
('810',17,61,'望德堂區','三級',145,18.0,'健康',22.153889,113.559869),
('47',17,126,'聖方濟各堂區','三級',145,17.0,'健康',22.121034,113.570844),
('484',51,68,'花王堂區','三級',145,16.0,'健康',22.200735,113.539681),
('365',9,23,'風順堂區','三級',145,15.0,'健康',22.18688,113.534626),
('298',51,37,'望德堂區','三級',145,15.0,'健康',22.194933,113.551627),
('947',21,11,'嘉模堂區','三級',145,13.0,'健康',22.164331,113.558667),
('652',9,94,'路氹填海區','三級',145,9.01,'健康',22.138405,113.565588),
('429',34,68,'花王堂區','三級',145,9.0,'健康',22.201049,113.539483),
('552',9,3,'嘉模堂區','三級',145,13.0,'瀕危',22.154067,113.558747),
('975',15,43,'風順堂區','三級',140,14.0,'一般',22.184031,113.530845),
('231',36,88,'花地瑪堂區','三級',135,32.0,'一般',22.211757,113.537767),
('472',4,68,'花王堂區','三級',135,24.0,'一般',22.200172,113.539381),
('906',10,87,'望德堂區','三級',135,24.0,'一般',22.199139,113.542638),
('471',4,68,'花王堂區','三級',135,23.0,'一般',22.201275,113.53951),
('436',9,68,'花王堂區','三級',135,22.0,'一般',22.200362,113.53951),
('232',36,88,'花地瑪堂區','三級',135,22.0,'一般',22.211084,113.537792),
('441',9,68,'花王堂區','三級',135,21.0,'一般',22.201246,113.53897),
('835',46,36,'大堂區','三級',135,21.0,'一般',22.192373,113.545103),
('529',37,69,'望德堂區','三級',135,20.0,'一般',22.200197,113.547893),
('511',45,68,'花王堂區','三級',135,19.0,'一般',22.200863,113.539891),
('249',21,88,'花地瑪堂區','三級',135,19.0,'一般',22.211037,113.537392),
('913',16,105,'聖方濟各堂區','三級',135,18.0,'一般',22.200773,113.541784),
('427',9,68,'花王堂區','三級',135,17.0,'一般',22.200468,113.538844),
('470',16,68,'花王堂區','三級',135,17.0,'一般',22.200561,113.538633),
('534',16,69,'望德堂區','三級',135,17.0,'一般',22.20039,113.548338),
('247',21,88,'花地瑪堂區','三級',135,17.0,'一般',22.211558,113.538079),
('1051',9,63,'大堂區','三級',135,16.0,'一般',22.191832,113.544952),
('246',17,88,'花地瑪堂區','三級',135,16.0,'一般',22.2116,113.537246),
('430',9,68,'花王堂區','三級',135,15.0,'一般',22.201214,113.539282),
('706',16,64,'花王堂區','三級',135,15.0,'一般',22.196524,113.542777),
('718',10,52,'花地瑪堂區','三級',135,15.0,'一般',22.204167,113.550663),
('720',9,52,'花地瑪堂區','三級',135,15.0,'一般',22.204442,113.549902),
('1061',16,102,'聖方濟各堂區','三級',135,15.0,'一般',22.187538,113.533527),
('490',35,68,'花王堂區','三級',135,14.0,'一般',22.20109,113.538653),
('512',46,68,'花王堂區','三級',135,14.0,'一般',22.200241,113.538785),
('469',5,68,'花王堂區','三級',135,11.0,'一般',22.20054,113.53977),
('840',56,36,'大堂區','三級',135,11.0,'一般',22.19226,113.544167),
('364',24,23,'風順堂區','三級',135,11.0,'一般',22.187148,113.535452),
('1111',20,49,'花王堂區','三級',135,11.0,'一般',22.204207,113.549033),
('826',24,36,'大堂區','三級',135,10.0,'一般',22.192818,113.544414),
('221',36,88,'花地瑪堂區','三級',135,10.0,'一般',22.211282,113.53733),
('49',11,126,'聖方濟各堂區','三級',135,10.0,'一般',22.121364,113.569911),
('533',56,69,'望德堂區','三級',135,8.0,'一般',22.200769,113.547754),
('777',47,90,'花地瑪堂區','三級',135,6.0,'一般',22.203456,113.553643),
('882',1,30,'風順堂區','三級',135,6.0,'一般',22.192537,113.537257),
('1123',47,77,'大堂區','三級',135,5.0,'一般',22.211993,113.545846),
('792',10,80,'花地瑪堂區','三級',135,25.0,'健康',22.210009,113.547719),
('438',9,68,'花王堂區','三級',135,23.0,'健康',22.201008,113.539693),
('437',9,68,'花王堂區','三級',135,22.0,'健康',22.200863,113.538694),
('440',9,68,'花王堂區','三級',135,20.0,'健康',22.200255,113.539043),
('702',19,107,'聖方濟各堂區','三級',135,17.3,'健康',22.126662,113.558964),
('1102',16,91,'花王堂區','三級',135,15.0,'健康',22.198035,113.541084),
('16',33,96,'聖方濟各堂區','三級',135,5.0,'瀕危',22.134736,113.581197),
('520',56,69,'望德堂區','三級',135,4.5,'瀕危',22.200642,113.548166),
('1134',9,75,'風順堂區','三級',133,16.0,'健康',22.183186,113.53142),
('214',16,88,'花地瑪堂區','三級',125,30.0,'一般',22.211138,113.538086),
('273',51,57,'望德堂區','三級',125,23.5,'一般',22.198506,113.551333),
('203',56,88,'花地瑪堂區','三級',125,23.0,'一般',22.2119,113.537526),
('241',21,88,'花地瑪堂區','三級',125,22.0,'一般',22.211859,113.538028),
('17',9,96,'聖方濟各堂區','三級',125,22.0,'一般',22.134323,113.581408),
('442',4,68,'花王堂區','三級',125,20.0,'一般',22.201419,113.539156),
('801',9,66,'花地瑪堂區','三級',125,20.0,'一般',22.207403,113.546366),
('229',36,88,'花地瑪堂區','三級',125,20.0,'一般',22.211361,113.537066),
('2',9,107,'聖方濟各堂區','三級',125,20.0,'一般',22.126802,113.558627),
('22',9,96,'聖方濟各堂區','三級',125,20.0,'一般',22.13444,113.580915),
('350',17,57,'望德堂區','三級',125,19.0,'一般',22.198279,113.551165),
('88',9,110,'聖方濟各堂區','三級',125,19.0,'一般',22.11455,113.561239),
('97',9,110,'聖方濟各堂區','三級',125,18.5,'一般',22.114361,113.561559),
('257',51,57,'望德堂區','三級',125,18.0,'一般',22.198657,113.55183),
('476',28,68,'花王堂區','三級',125,18.0,'一般',22.200292,113.539755),
('833',46,36,'大堂區','三級',125,18.0,'一般',22.191936,113.544887);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('242',21,88,'花地瑪堂區','三級',125,18.0,'一般',22.210843,113.537664),
('75',9,110,'聖方濟各堂區','三級',125,18.0,'一般',22.114272,113.560836),
('81',9,110,'聖方濟各堂區','三級',125,18.0,'一般',22.114309,113.561067),
('89',9,110,'聖方濟各堂區','三級',125,18.0,'一般',22.113925,113.560418),
('91',9,110,'聖方濟各堂區','三級',125,18.0,'一般',22.114963,113.560579),
('76',9,110,'聖方濟各堂區','三級',125,17.5,'一般',22.114415,113.560495),
('268',51,57,'望德堂區','三級',125,17.0,'一般',22.198013,113.551854),
('379',16,24,'風順堂區','三級',125,17.0,'一般',22.187198,113.534578),
('83',9,110,'聖方濟各堂區','三級',125,17.0,'一般',22.114781,113.560864),
('84',9,110,'聖方濟各堂區','三級',125,17.0,'一般',22.113988,113.560895),
('647',9,22,'嘉模堂區','三級',125,16.0,'一般',22.160658,113.561792),
('20',9,96,'聖方濟各堂區','三級',125,16.0,'一般',22.135102,113.581215),
('21',9,96,'聖方濟各堂區','三級',125,16.0,'一般',22.134576,113.582031),
('98',9,110,'聖方濟各堂區','三級',125,16.0,'一般',22.113872,113.560034),
('182',9,100,'聖方濟各堂區','三級',125,16.0,'一般',22.117327,113.552431),
('184',9,100,'聖方濟各堂區','三級',125,16.0,'一般',22.117235,113.5519),
('513',42,69,'望德堂區','三級',125,15.0,'一般',22.200296,113.547551),
('69',9,120,'聖方濟各堂區','三級',125,15.0,'一般',22.115404,113.55665),
('82',9,110,'聖方濟各堂區','三級',125,15.0,'一般',22.114224,113.560354),
('116',9,112,'聖方濟各堂區','三級',125,15.0,'一般',22.119013,113.550569),
('747',9,109,'聖方濟各堂區','三級',125,15.0,'一般',22.202447,113.539753),
('748',9,109,'聖方濟各堂區','三級',125,15.0,'一般',22.201705,113.540912),
('363',9,23,'風順堂區','三級',125,14.0,'一般',22.186243,113.534914),
('130',9,122,'聖方濟各堂區','三級',125,14.0,'一般',22.116158,113.550944),
('155',9,101,'聖方濟各堂區','三級',125,14.0,'一般',22.115197,113.551811),
('156',9,101,'聖方濟各堂區','三級',125,14.0,'一般',22.1151,113.550993),
('799',9,72,'花地瑪堂區','三級',125,13.0,'一般',22.207577,113.546931),
('800',9,72,'花地瑪堂區','三級',125,13.0,'一般',22.207379,113.54533),
('545',46,85,'花地瑪堂區','三級',125,13.0,'一般',22.206658,113.548469),
('135',9,97,'聖方濟各堂區','三級',125,13.0,'一般',22.11454,113.550273),
('151',9,101,'聖方濟各堂區','三級',125,13.0,'一般',22.115317,113.55117),
('154',9,101,'聖方濟各堂區','三級',125,13.0,'一般',22.11559,113.551205),
('163',9,101,'聖方濟各堂區','三級',125,13.0,'一般',22.11488,113.552048),
('164',9,101,'聖方濟各堂區','三級',125,13.0,'一般',22.115199,113.550583),
('566',17,18,'嘉模堂區','三級',125,12.01,'一般',22.15414,113.560227),
('616',9,8,'嘉模堂區','三級',125,12.0,'一般',22.152388,113.555624),
('795',9,72,'花地瑪堂區','三級',125,12.0,'一般',22.207802,113.545782),
('125',9,122,'聖方濟各堂區','三級',125,12.0,'一般',22.117133,113.551104),
('126',9,122,'聖方濟各堂區','三級',125,12.0,'一般',22.116766,113.551333),
('153',9,101,'聖方濟各堂區','三級',125,12.0,'一般',22.114999,113.551349),
('161',9,101,'聖方濟各堂區','三級',125,12.0,'一般',22.114743,113.551059),
('166',9,101,'聖方濟各堂區','三級',125,12.0,'一般',22.115918,113.55197),
('167',9,101,'聖方濟各堂區','三級',125,12.0,'一般',22.114445,113.551444),
('288',8,57,'望德堂區','三級',125,11.0,'一般',22.198466,113.552127),
('162',9,101,'聖方濟各堂區','三級',125,11.0,'一般',22.115966,113.551247),
('331',17,57,'望德堂區','三級',125,10.0,'一般',22.198067,113.552133),
('524',20,69,'望德堂區','三級',125,10.0,'一般',22.200914,113.548116),
('662',10,93,'路氹填海區','三級',125,8.01,'一般',22.139344,113.552876),
('784',9,25,'望德堂區','三級',125,20.0,'健康',22.199906,113.55163),
('897',9,26,'風順堂區','三級',125,20.0,'健康',22.18837,113.535195),
('837',9,35,'大堂區','三級',125,19.0,'健康',22.192542,113.545298),
('77',9,110,'聖方濟各堂區','三級',125,18.0,'健康',22.114541,113.560916),
('87',9,110,'聖方濟各堂區','三級',125,18.0,'健康',22.114599,113.560247),
('96',9,110,'聖方濟各堂區','三級',125,18.0,'健康',22.114929,113.560141),
('78',9,110,'聖方濟各堂區','三級',125,17.0,'健康',22.11413,113.560662),
('86',9,111,'聖方濟各堂區','三級',125,17.0,'健康',22.11982,113.555708),
('15',9,96,'聖方濟各堂區','三級',125,17.0,'健康',22.134914,113.581765),
('71',9,117,'聖方濟各堂區','三級',125,16.0,'健康',22.116072,113.556716),
('93',9,110,'聖方濟各堂區','三級',125,16.0,'健康',22.114314,113.560019),
('94',9,110,'聖方濟各堂區','三級',125,16.0,'健康',22.114919,113.561188),
('95',9,110,'聖方濟各堂區','三級',125,16.0,'健康',22.113681,113.560745),
('183',9,100,'聖方濟各堂區','三級',125,16.0,'健康',22.11696,113.55266),
('187',9,100,'聖方濟各堂區','三級',125,16.0,'健康',22.117602,113.553008),
('188',9,100,'聖方濟各堂區','三級',125,16.0,'健康',22.116352,113.552271),
('303',17,57,'望德堂區','三級',125,15.0,'健康',22.19797,113.551473),
('648',9,11,'嘉模堂區','三級',125,15.0,'健康',22.164661,113.557734),
('651',9,10,'嘉模堂區','三級',125,15.0,'健康',22.162291,113.559538),
('866',9,56,'望德堂區','三級',125,15.0,'健康',22.195845,113.545423),
('1113',56,27,'風順堂區','三級',125,15.0,'健康',22.187438,113.535299),
('131',9,97,'聖方濟各堂區','三級',125,15.0,'健康',22.115279,113.550388),
('132',9,97,'聖方濟各堂區','三級',125,15.0,'健康',22.114956,113.550574),
('133',9,97,'聖方濟各堂區','三級',125,15.0,'健康',22.115177,113.549986),
('137',9,97,'聖方濟各堂區','三級',125,15.0,'健康',22.114922,113.551278),
('149',9,101,'聖方濟各堂區','三級',125,15.0,'健康',22.115433,113.551406),
('159',9,101,'聖方濟各堂區','三級',125,15.0,'健康',22.115534,113.550861),
('729',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.202035,113.540129),
('730',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.201725,113.540302),
('731',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.20193,113.539763),
('732',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.202169,113.540508),
('733',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.201363,113.540026),
('749',9,109,'聖方濟各堂區','三級',125,15.0,'健康',22.201507,113.539311),
('72',9,117,'聖方濟各堂區','三級',125,14.0,'健康',22.115308,113.557338),
('127',9,122,'聖方濟各堂區','三級',125,14.0,'健康',22.117041,113.550573),
('129',9,122,'聖方濟各堂區','三級',125,14.0,'健康',22.117408,113.551681),
('150',9,101,'聖方濟各堂區','三級',125,14.0,'健康',22.115167,113.551535),
('157',9,101,'聖方濟各堂區','三級',125,14.0,'健康',22.115742,113.551581),
('1064',9,119,'聖方濟各堂區','三級',125,14.0,'健康',22.113474,113.550851),
('1065',9,119,'聖方濟各堂區','三級',125,14.0,'健康',22.11271,113.551473),
('793',9,72,'花地瑪堂區','三級',125,13.0,'健康',22.207907,113.546148),
('794',9,72,'花地瑪堂區','三級',125,13.0,'健康',22.207597,113.546321),
('796',9,72,'花地瑪堂區','三級',125,13.0,'健康',22.208041,113.546528),
('797',9,72,'花地瑪堂區','三級',125,13.0,'健康',22.207235,113.546045),
('798',9,72,'花地瑪堂區','三級',125,13.0,'健康',22.208319,113.545772),
('372',9,23,'風順堂區','三級',125,13.0,'健康',22.187466,113.534604),
('3',9,107,'聖方濟各堂區','三級',125,13.0,'健康',22.126927,113.559041),
('134',9,97,'聖方濟各堂區','三級',125,13.0,'健康',22.115445,113.550811),
('136',9,97,'聖方濟各堂區','三級',125,13.0,'健康',22.115763,113.549963),
('152',9,101,'聖方濟各堂區','三級',125,13.0,'健康',22.115457,113.55163),
('160',9,101,'聖方濟各堂區','三級',125,13.0,'健康',22.115477,113.552024),
('923',24,20,'嘉模堂區','三級',125,12.01,'健康',22.155019,113.557231);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('922',56,5,'嘉模堂區','三級',125,12.0,'健康',22.162535,113.55802),
('158',9,101,'聖方濟各堂區','三級',125,12.0,'健康',22.114822,113.551618),
('6',9,107,'聖方濟各堂區','三級',125,16.0,'瀕危',22.126524,113.558792),
('565',17,18,'嘉模堂區','三級',125,12.01,'瀕危',22.154904,113.559605),
('79',9,110,'聖方濟各堂區','三級',125,10.0,'瀕危',22.114655,113.560536),
('306',17,57,'望德堂區','三級',125,8.0,'瀕危',22.19879,113.551601),
('92',9,110,'聖方濟各堂區','三級',125,8.0,'瀕危',22.114044,113.561255),
('832',46,36,'大堂區','三級',125,2.0,'瀕危',22.193,113.544843),
('601',11,21,'嘉模堂區','三級',123,12.0,'一般',22.203164,113.546399),
('665',37,107,'聖方濟各堂區','三級',118,17.0,'一般',22.127037,113.558669),
('329',50,57,'望德堂區','三級',115,30.0,'一般',22.199051,113.551354),
('479',10,68,'花王堂區','三級',115,28.0,'一般',22.200037,113.539613),
('222',36,88,'花地瑪堂區','三級',115,28.0,'一般',22.211594,113.536851),
('514',10,69,'望德堂區','三級',115,26.0,'一般',22.20003,113.548152),
('530',10,69,'望德堂區','三級',115,26.0,'一般',22.199674,113.547984),
('782',10,25,'望德堂區','三級',115,26.0,'一般',22.200455,113.551912),
('215',16,88,'花地瑪堂區','三級',115,25.0,'一般',22.212118,113.537738),
('211',21,88,'花地瑪堂區','三級',115,21.0,'一般',22.211003,113.537085),
('252',21,88,'花地瑪堂區','三級',115,20.5,'一般',22.211101,113.538488),
('353',18,57,'望德堂區','三級',115,20.0,'一般',22.198034,113.552508),
('354',19,57,'望德堂區','三級',115,20.0,'一般',22.198064,113.550865),
('355',19,57,'望德堂區','三級',115,20.0,'一般',22.199099,113.552136),
('521',9,69,'望德堂區','三級',115,20.0,'一般',22.199956,113.547616),
('769',9,90,'花地瑪堂區','三級',115,20.0,'一般',22.203163,113.5538),
('774',9,90,'花地瑪堂區','三級',115,20.0,'一般',22.203162,113.554283),
('907',16,50,'花王堂區','三級',115,20.0,'一般',22.198042,113.5417),
('948',9,81,'花地瑪堂區','三級',115,20.0,'一般',22.209227,113.548308),
('304',17,57,'望德堂區','三級',115,19.0,'一般',22.198993,113.551801),
('423',9,43,'風順堂區','三級',115,19.0,'一般',22.183721,113.531018),
('61',16,124,'聖方濟各堂區','三級',115,19.0,'一般',22.119287,113.566692),
('250',21,88,'花地瑪堂區','三級',115,18.6,'一般',22.212181,113.537263),
('713',9,40,'花王堂區','三級',115,18.0,'一般',22.196815,113.542668),
('716',9,40,'花王堂區','三級',115,18.0,'一般',22.197792,113.542281),
('770',9,90,'花地瑪堂區','三級',115,18.0,'一般',22.203347,113.553326),
('771',9,90,'花地瑪堂區','三級',115,18.0,'一般',22.203549,113.553964),
('773',9,90,'花地瑪堂區','三級',115,18.0,'一般',22.203772,113.553333),
('868',9,51,'望德堂區','三級',115,18.0,'一般',22.19748,113.547749),
('903',46,50,'望德堂區','三級',115,18.0,'一般',22.198806,113.541077),
('220',16,88,'花地瑪堂區','三級',115,18.0,'一般',22.210839,113.538082),
('735',9,104,'聖方濟各堂區','三級',115,18.0,'一般',22.119389,113.552011),
('742',9,104,'聖方濟各堂區','三級',115,18.0,'一般',22.119878,113.552248),
('1090',16,108,'聖方濟各堂區','三級',115,18.0,'一般',22.131677,113.560237),
('380',16,24,'風順堂區','三級',115,17.0,'一般',22.187783,113.534083),
('522',26,69,'望德堂區','三級',115,17.0,'一般',22.201126,113.547796),
('525',4,69,'望德堂區','三級',115,17.0,'一般',22.200088,113.548561),
('526',17,69,'望德堂區','三級',115,17.0,'一般',22.200393,113.547162),
('834',46,36,'大堂區','三級',115,17.0,'一般',22.193271,113.544455),
('321',7,57,'望德堂區','三級',115,16.0,'一般',22.197625,113.551459),
('374',9,24,'風順堂區','三級',115,16.0,'一般',22.1871,113.534124),
('715',9,40,'花王堂區','三級',115,16.0,'一般',22.196638,113.541233),
('883',34,30,'風順堂區','三級',115,16.0,'一般',22.192282,113.53855),
('963',9,44,'風順堂區','三級',115,16.0,'一般',22.185866,113.530691),
('964',9,44,'風順堂區','三級',115,16.0,'一般',22.187089,113.530381),
('967',9,43,'風順堂區','三級',115,16.0,'一般',22.184165,113.531224),
('1041',9,58,'風順堂區','三級',115,16.0,'一般',22.186581,113.537741),
('789',9,80,'花地瑪堂區','三級',115,16.0,'一般',22.209245,113.548342),
('202',56,88,'花地瑪堂區','三級',115,16.0,'一般',22.211865,113.53717),
('176',9,106,'聖方濟各堂區','三級',115,16.0,'一般',22.116264,113.553009),
('181',9,106,'聖方濟各堂區','三級',115,16.0,'一般',22.114949,113.55232),
('681',9,107,'聖方濟各堂區','三級',115,16.0,'一般',22.127157,113.558989),
('686',9,107,'聖方濟各堂區','三級',115,16.0,'一般',22.127331,113.558712),
('688',9,107,'聖方濟各堂區','三級',115,16.0,'一般',22.126705,113.558173),
('921',9,108,'聖方濟各堂區','三級',115,16.0,'一般',22.131617,113.559319),
('258',51,57,'望德堂區','三級',115,15.0,'一般',22.19875,113.552077),
('318',7,57,'望德堂區','三級',115,15.0,'一般',22.198499,113.550964),
('319',7,57,'望德堂區','三級',115,15.0,'一般',22.198707,113.552391),
('435',52,68,'花王堂區','三級',115,15.0,'一般',22.201234,113.539785),
('458',28,68,'花王堂區','三級',115,15.0,'一般',22.200619,113.540022),
('517',16,69,'望德堂區','三級',115,15.0,'一般',22.200713,113.547426),
('558',9,2,'嘉模堂區','三級',115,15.0,'一般',22.153526,113.558974),
('560',9,2,'嘉模堂區','三級',115,15.0,'一般',22.153159,113.559203),
('563',9,2,'嘉模堂區','三級',115,15.0,'一般',22.152551,113.558814),
('608',9,8,'嘉模堂區','三級',115,15.0,'一般',22.151713,113.555218),
('609',9,8,'嘉模堂區','三級',115,15.0,'一般',22.152611,113.554994),
('772',9,90,'花地瑪堂區','三級',115,15.0,'一般',22.202874,113.553558),
('879',20,30,'風順堂區','三級',115,15.0,'一般',22.192805,113.538083),
('959',9,44,'風順堂區','三級',115,15.0,'一般',22.186605,113.530806),
('960',9,44,'風順堂區','三級',115,15.0,'一般',22.186282,113.530992),
('961',9,44,'風順堂區','三級',115,15.0,'一般',22.186503,113.530403),
('973',9,43,'風順堂區','三級',115,15.0,'一般',22.183359,113.530742),
('974',9,43,'風順堂區','三級',115,15.0,'一般',22.184443,113.530469),
('976',9,43,'風順堂區','三級',115,15.0,'一般',22.183701,113.531628),
('977',9,43,'風順堂區','三級',115,15.0,'一般',22.183503,113.530027),
('1043',9,58,'風順堂區','三級',115,15.0,'一般',22.186684,113.536784),
('506',55,65,'花王堂區','三級',115,15.0,'一般',22.196701,113.547176),
('887',16,76,'風順堂區','三級',115,15.0,'一般',22.186571,113.541823),
('958',28,42,'風順堂區','三級',115,15.0,'一般',22.18548,113.53189),
('243',17,88,'花地瑪堂區','三級',115,15.0,'一般',22.210668,113.537375),
('755',9,17,'嘉模堂區','三級',115,15.0,'一般',22.155719,113.558231),
('628',9,9,'嘉模堂區','三級',115,15.0,'一般',22.151973,113.55636),
('629',9,9,'嘉模堂區','三級',115,15.0,'一般',22.150998,113.555081),
('751',9,17,'嘉模堂區','三級',115,15.0,'一般',22.155254,113.55684),
('59',31,107,'聖方濟各堂區','三級',115,15.0,'一般',22.126618,113.558494),
('112',9,103,'聖方濟各堂區','三級',115,15.0,'一般',22.119673,113.54995),
('113',9,103,'聖方濟各堂區','三級',115,15.0,'一般',22.119262,113.550223),
('114',9,103,'聖方濟各堂區','三級',115,15.0,'一般',22.119592,113.54929),
('115',9,103,'聖方濟各堂區','三級',115,15.0,'一般',22.120057,113.550681),
('683',9,107,'聖方濟各堂區','三級',115,15.0,'一般',22.126981,113.558391),
('684',9,107,'聖方濟各堂區','三級',115,15.0,'一般',22.126933,113.559351),
('692',9,107,'聖方濟各堂區','三級',115,15.0,'一般',22.12675,113.559657);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('695',9,107,'聖方濟各堂區','三級',115,15.0,'一般',22.127598,113.55896),
('744',9,104,'聖方濟各堂區','三級',115,15.0,'一般',22.118973,113.55171),
('745',9,104,'聖方濟各堂區','三級',115,15.0,'一般',22.120196,113.5514),
('746',9,104,'聖方濟各堂區','三級',115,15.0,'一般',22.119355,113.552715),
('27',16,123,'聖方濟各堂區','三級',115,15.0,'一般',22.134488,113.582245),
('38',9,123,'聖方濟各堂區','三級',115,15.0,'一般',22.134715,113.581411),
('1081',9,121,'聖方濟各堂區','三級',115,15.0,'一般',22.117573,113.552733),
('1082',9,121,'聖方濟各堂區','三級',115,15.0,'一般',22.117162,113.553006),
('194',17,53,'花地瑪堂區','三級',115,14.0,'一般',22.207418,113.548159),
('482',52,68,'花王堂區','三級',115,14.0,'一般',22.201041,113.538382),
('561',9,2,'嘉模堂區','三級',115,14.0,'一般',22.153434,113.558443),
('610',9,8,'嘉模堂區','三級',115,14.0,'一般',22.152001,113.555943),
('611',9,8,'嘉模堂區','三級',115,14.0,'一般',22.15184,113.554638),
('612',9,8,'嘉模堂區','三級',115,14.0,'一般',22.152887,113.55559),
('644',9,19,'嘉模堂區','三級',115,14.0,'一般',22.159883,113.558142),
('645',9,19,'嘉模堂區','三級',115,14.0,'一般',22.161316,113.558362),
('646',9,19,'嘉模堂區','三級',115,14.0,'一般',22.160042,113.559302),
('822',9,46,'大堂區','三級',115,14.0,'一般',22.19269,113.544157),
('870',9,92,'望德堂區','三級',115,14.0,'一般',22.198421,113.548321),
('872',9,92,'望德堂區','三級',115,14.0,'一般',22.197657,113.548944),
('983',9,58,'風順堂區','三級',115,14.0,'一般',22.186024,113.537955),
('985',9,58,'風順堂區','三級',115,14.0,'一般',22.186837,113.537428),
('987',9,58,'風順堂區','三級',115,14.0,'一般',22.186405,113.536472),
('656',9,16,'嘉模堂區','三級',115,14.0,'一般',22.157169,113.54239),
('148',10,113,'聖方濟各堂區','三級',115,14.0,'一般',22.115785,113.55094),
('687',9,107,'聖方濟各堂區','三級',115,14.0,'一般',22.126444,113.559365),
('690',9,107,'聖方濟各堂區','三級',115,14.0,'一般',22.126096,113.558873),
('691',9,107,'聖方濟各堂區','三級',115,14.0,'一般',22.127297,113.558292),
('918',9,108,'聖方濟各堂區','三級',115,14.0,'一般',22.131178,113.560597),
('36',9,123,'聖方濟各堂區','三級',115,14.0,'一般',22.13502,113.582508),
('192',9,53,'花地瑪堂區','三級',115,13.0,'一般',22.207917,113.547799),
('195',21,53,'花地瑪堂區','三級',115,13.0,'一般',22.207857,113.546881),
('262',51,57,'望德堂區','三級',115,13.0,'一般',22.197788,113.551732),
('266',44,57,'望德堂區','三級',115,13.0,'一般',22.198756,113.551265),
('473',5,68,'花王堂區','三級',115,13.0,'一般',22.201518,113.539441),
('491',52,68,'花王堂區','三級',115,13.0,'一般',22.199984,113.53882),
('554',9,3,'嘉模堂區','三級',115,13.0,'一般',22.154451,113.559478),
('562',9,2,'嘉模堂區','三級',115,13.0,'一般',22.153801,113.559551),
('615',9,8,'嘉模堂區','三級',115,13.0,'一般',22.151371,113.555655),
('623',9,9,'嘉模堂區','三級',115,13.0,'一般',22.151481,113.555012),
('624',9,9,'嘉模堂區','三級',115,13.0,'一般',22.152313,113.55577),
('625',9,9,'嘉模堂區','三級',115,13.0,'一般',22.151113,113.555821),
('627',9,9,'嘉模堂區','三級',115,13.0,'一般',22.152047,113.554826),
('722',9,83,'花地瑪堂區','三級',115,13.0,'一般',22.20443,113.55253),
('900',9,45,'風順堂區','三級',115,13.0,'一般',22.187265,113.532219),
('962',9,44,'風順堂區','三級',115,13.0,'一般',22.186771,113.531229),
('988',9,58,'風順堂區','三級',115,13.0,'一般',22.186432,113.537981),
('993',9,58,'風順堂區','三級',115,13.0,'一般',22.18682,113.53774),
('1122',45,77,'大堂區','三級',115,13.0,'一般',22.211229,113.546469),
('209',21,88,'花地瑪堂區','三級',115,13.0,'一般',22.2114,113.538329),
('766',39,62,'花地瑪堂區','三級',115,13.0,'一般',22.203315,113.555343),
('35',9,123,'聖方濟各堂區','三級',115,13.0,'一般',22.134059,113.581634),
('37',9,123,'聖方濟各堂區','三級',115,13.0,'一般',22.133631,113.582567),
('1084',52,121,'聖方濟各堂區','三級',115,13.0,'一般',22.117957,113.553464),
('448',43,68,'花王堂區','三級',115,12.0,'一般',22.201348,113.538729),
('637',9,19,'嘉模堂區','三級',115,12.0,'一般',22.160863,113.558321),
('638',9,19,'嘉模堂區','三級',115,12.0,'一般',22.160418,113.55901),
('639',9,19,'嘉模堂區','三級',115,12.0,'一般',22.160305,113.558075),
('641',9,19,'嘉模堂區','三級',115,12.0,'一般',22.159981,113.558794),
('642',9,19,'嘉模堂區','三級',115,12.0,'一般',22.160808,113.557914),
('643',9,19,'嘉模堂區','三級',115,12.0,'一般',22.160742,113.559269),
('904',38,73,'望德堂區','三級',115,12.0,'一般',22.197706,113.544163),
('990',9,58,'風順堂區','三級',115,12.0,'一般',22.186896,113.536974),
('994',9,55,'風順堂區','三級',115,12.0,'一般',22.181658,113.531607),
('997',9,55,'風順堂區','三級',115,12.0,'一般',22.182042,113.532338),
('1006',9,58,'風順堂區','三級',115,12.0,'一般',22.18609,113.537451),
('1025',9,58,'風順堂區','三級',115,12.0,'一般',22.186379,113.537661),
('1036',9,58,'風順堂區','三級',115,12.0,'一般',22.186245,113.537838),
('1119',34,33,'花地瑪堂區','三級',115,12.0,'一般',22.206909,113.550366),
('370',52,23,'風順堂區','三級',115,12.0,'一般',22.186625,113.535919),
('765',56,62,'花地瑪堂區','三級',115,12.0,'一般',22.20285,113.553952),
('734',9,104,'聖方濟各堂區','三級',115,12.0,'一般',22.119712,113.551825),
('25',14,95,'聖方濟各堂區','三級',115,12.0,'一般',22.150004,113.588443),
('519',23,69,'望德堂區','三級',115,11.0,'一般',22.200659,113.548539),
('727',9,83,'花地瑪堂區','三級',115,11.0,'一般',22.203666,113.553153),
('841',5,36,'大堂區','三級',115,11.0,'一般',22.191997,113.545395),
('1002',9,58,'風順堂區','三級',115,11.0,'一般',22.186161,113.537049),
('1011',9,58,'風順堂區','三級',115,11.0,'一般',22.186233,113.53752),
('1015',9,58,'風順堂區','三級',115,11.0,'一般',22.185958,113.537514),
('1023',9,58,'風順堂區','三級',115,11.0,'一般',22.185787,113.537495),
('1024',9,58,'風順堂區','三級',115,11.0,'一般',22.186246,113.536747),
('1030',9,58,'風順堂區','三級',115,11.0,'一般',22.186621,113.537493),
('1099',6,40,'花王堂區','三級',115,11.0,'一般',22.196824,113.542129),
('1120',34,33,'花地瑪堂區','三級',115,11.0,'一般',22.206145,113.550989),
('689',9,107,'聖方濟各堂區','三級',115,10.01,'一般',22.127288,113.559299),
('984',9,58,'風順堂區','三級',115,10.0,'一般',22.185773,113.536583),
('989',9,58,'風順堂區','三級',115,10.0,'一般',22.185451,113.536868),
('991',9,58,'風順堂區','三級',115,10.0,'一般',22.185743,113.537968),
('992',9,58,'風順堂區','三級',115,10.0,'一般',22.185977,113.536367),
('996',9,55,'風順堂區','三級',115,10.0,'一般',22.181577,113.530947),
('998',9,58,'風順堂區','三級',115,10.0,'一般',22.185314,113.537336),
('1001',9,58,'風順堂區','三級',115,10.0,'一般',22.186037,113.537332),
('1009',9,58,'風順堂區','三級',115,10.0,'一般',22.185907,113.537331),
('1010',9,58,'風順堂區','三級',115,10.0,'一般',22.186263,113.536957),
('1021',9,58,'風順堂區','三級',115,10.0,'一般',22.185884,113.536883),
('1027',9,58,'風順堂區','三級',115,10.0,'一般',22.186596,113.537),
('1029',9,58,'風順堂區','三級',115,10.0,'一般',22.18597,113.536694),
('1033',9,58,'風順堂區','三級',115,10.0,'一般',22.185616,113.537375),
('1035',9,58,'風順堂區','三級',115,10.0,'一般',22.186452,113.536712),
('1039',9,58,'風順堂區','三級',115,10.0,'一般',22.185727,113.537714);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('507',34,65,'花王堂區','三級',115,10.0,'一般',22.19742,113.548565),
('909',41,74,'大堂區','三級',115,10.0,'一般',22.195272,113.543987),
('738',9,104,'聖方濟各堂區','三級',115,10.0,'一般',22.11961,113.551423),
('34',9,123,'聖方濟各堂區','三級',115,10.0,'一般',22.134206,113.582835),
('965',56,44,'風順堂區','三級',115,9.0,'一般',22.186248,113.531696),
('999',9,58,'風順堂區','三級',115,9.0,'一般',22.1867,113.536522),
('1000',9,58,'風順堂區','三級',115,9.0,'一般',22.186282,113.537224),
('1007',9,58,'風順堂區','三級',115,9.0,'一般',22.18604,113.537002),
('1037',9,58,'風順堂區','三級',115,9.0,'一般',22.18568,113.536833),
('1038',9,58,'風順堂區','三級',115,9.0,'一般',22.18675,113.53717),
('898',20,86,'風順堂區','三級',115,9.0,'一般',22.188722,113.534413),
('663',10,93,'路氹填海區','三級',115,8.01,'一般',22.139783,113.551598),
('313',9,57,'望德堂區','三級',115,8.0,'一般',22.197786,113.552126),
('489',12,68,'花王堂區','三級',115,8.0,'一般',22.201071,113.540053),
('880',47,30,'風順堂區','三級',115,8.0,'一般',22.1919,113.537545),
('881',47,30,'風順堂區','三級',115,8.0,'一般',22.193123,113.537235),
('995',9,55,'風順堂區','三級',115,8.0,'一般',22.181247,113.53188),
('1008',9,58,'風順堂區','三級',115,8.0,'一般',22.186377,113.537315),
('1012',9,58,'風順堂區','三級',115,8.0,'一般',22.185887,113.537061),
('1014',9,58,'風順堂區','三級',115,8.0,'一般',22.186454,113.537151),
('1042',9,58,'風順堂區','三級',115,8.0,'一般',22.18549,113.537158),
('44',49,126,'聖方濟各堂區','三級',115,8.0,'一般',22.121829,113.571302),
('1060',22,102,'聖方濟各堂區','三級',115,8.0,'一般',22.187977,113.532249),
('11',13,96,'聖方濟各堂區','三級',115,8.0,'一般',22.135331,113.581725),
('70',38,120,'聖方濟各堂區','三級',115,7.01,'一般',22.114905,113.55701),
('459',5,68,'花王堂區','三級',115,7.0,'一般',22.200342,113.538506),
('1005',9,58,'風順堂區','三級',115,7.0,'一般',22.186319,113.537106),
('1028',9,58,'風順堂區','三級',115,7.0,'一般',22.185951,113.53773),
('53',27,118,'聖方濟各堂區','三級',115,7.0,'一般',22.121646,113.559036),
('54',27,118,'聖方濟各堂區','三級',115,7.0,'一般',22.121976,113.558103),
('527',1,69,'望德堂區','三級',115,6.0,'一般',22.201078,113.548486),
('818',47,36,'大堂區','三級',115,6.0,'一般',22.192763,113.544007),
('779',47,90,'花地瑪堂區','三級',115,5.5,'一般',22.202532,113.553995),
('447',53,68,'花王堂區','三級',115,5.0,'一般',22.20003,113.539142),
('778',47,90,'花地瑪堂區','三級',115,5.0,'一般',22.204048,113.55393),
('952',47,52,'花地瑪堂區','三級',115,5.0,'一般',22.203559,113.550273),
('532',30,69,'望德堂區','三級',115,2.0,'一般',22.201092,113.547298),
('233',36,88,'花地瑪堂區','三級',115,35.0,'健康',22.211815,113.538363),
('19',16,96,'聖方濟各堂區','三級',115,24.0,'健康',22.135047,113.580711),
('711',9,40,'花王堂區','三級',115,20.0,'健康',22.197483,113.541627),
('85',16,111,'聖方濟各堂區','三級',115,20.0,'健康',22.119056,113.55633),
('90',16,110,'聖方濟各堂區','三級',115,20.0,'健康',22.115243,113.560836),
('655',9,12,'嘉模堂區','三級',115,19.0,'健康',22.158299,113.560959),
('827',3,36,'大堂區','三級',115,19.0,'健康',22.192697,113.545362),
('169',9,106,'聖方濟各堂區','三級',115,18.4,'健康',22.115543,113.552924),
('168',9,106,'聖方濟各堂區','三級',115,18.3,'健康',22.115822,113.552782),
('373',16,24,'風順堂區','三級',115,18.0,'健康',22.186858,113.534781),
('917',10,32,'花地瑪堂區','三級',115,18.0,'健康',22.213538,113.541981),
('1059',4,38,'花王堂區','三級',115,18.0,'健康',22.201951,113.539813),
('876',26,71,'望德堂區','三級',115,18.0,'健康',22.196907,113.548205),
('101',9,98,'聖方濟各堂區','三級',115,18.0,'健康',22.117804,113.551902),
('102',9,98,'聖方濟各堂區','三級',115,18.0,'健康',22.118025,113.551314),
('104',9,98,'聖方濟各堂區','三級',115,18.0,'健康',22.118293,113.552139),
('105',9,98,'聖方濟各堂區','三級',115,18.0,'健康',22.117388,113.551601),
('106',9,98,'聖方濟各堂區','三級',115,18.0,'健康',22.118611,113.551291),
('107',9,99,'聖方濟各堂區','三級',115,18.0,'健康',22.118111,113.551415),
('170',9,106,'聖方濟各堂區','三級',115,18.0,'健康',22.115709,113.552508),
('171',9,106,'聖方濟各堂區','三級',115,18.0,'健康',22.115878,113.553051),
('172',9,106,'聖方濟各堂區','三級',115,18.0,'健康',22.115318,113.552712),
('173',9,106,'聖方濟各堂區','三級',115,18.0,'健康',22.116053,113.55253),
('174',9,106,'聖方濟各堂區','三級',115,18.0,'健康',22.115559,113.553297),
('99',9,98,'聖方濟各堂區','三級',115,17.0,'健康',22.11777,113.552606),
('700',9,107,'聖方濟各堂區','三級',115,17.0,'健康',22.126084,113.559368),
('302',51,57,'望德堂區','三級',115,16.0,'健康',22.19794,113.551184),
('378',9,24,'風順堂區','三級',115,16.0,'健康',22.186364,113.534445),
('653',9,12,'嘉模堂區','三級',115,16.0,'健康',22.158359,113.561877),
('654',9,12,'嘉模堂區','三級',115,16.0,'健康',22.15786,113.562237),
('709',9,40,'花王堂區','三級',115,16.0,'健康',22.197236,113.542311),
('710',9,40,'花王堂區','三級',115,16.0,'健康',22.196503,113.541872),
('1040',9,58,'風順堂區','三級',115,16.0,'健康',22.18615,113.536541),
('1130',4,1,'嘉模堂區','三級',115,16.0,'健康',22.153139,113.55777),
('915',10,32,'花地瑪堂區','三級',115,16.0,'健康',22.213598,113.542899),
('1089',9,6,'嘉模堂區','三級',115,16.0,'健康',22.156,113.56),
('62',9,124,'聖方濟各堂區','三級',115,16.0,'健康',22.118523,113.567314),
('175',9,106,'聖方濟各堂區','三級',115,16.0,'健康',22.115432,113.552251),
('177',9,106,'聖方濟各堂區','三級',115,16.0,'健康',22.115064,113.553059),
('179',9,106,'聖方濟各堂區','三級',115,16.0,'健康',22.115924,113.553599),
('649',9,15,'嘉模堂區','三級',115,15.9,'健康',22.162157,113.559927),
('108',9,115,'聖方濟各堂區','三級',115,15.15,'健康',22.122029,113.552874),
('650',9,13,'嘉模堂區','三級',115,15.0,'健康',22.162599,113.56015),
('775',9,90,'花地瑪堂區','三級',115,15.0,'健康',22.203001,113.552978),
('986',9,58,'風順堂區','三級',115,15.0,'健康',22.185498,113.537583),
('916',10,32,'花地瑪堂區','三級',115,15.0,'健康',22.213099,113.543259),
('750',9,17,'嘉模堂區','三級',115,15.0,'健康',22.154924,113.557773),
('117',9,112,'聖方濟各堂區','三級',115,15.0,'健康',22.118703,113.550742),
('118',9,112,'聖方濟各堂區','三級',115,15.0,'健康',22.118908,113.550203),
('119',9,112,'聖方濟各堂區','三級',115,15.0,'健康',22.119147,113.550948),
('120',9,112,'聖方濟各堂區','三級',115,15.0,'健康',22.118341,113.550466),
('121',9,112,'聖方濟各堂區','三級',115,15.0,'健康',22.119425,113.550194),
('682',9,107,'聖方濟各堂區','三級',115,15.0,'健康',22.126389,113.559019),
('685',9,107,'聖方濟各堂區','三級',115,15.0,'健康',22.126329,113.558557),
('693',9,107,'聖方濟各堂區','三級',115,15.0,'健康',22.12628,113.558189),
('29',9,123,'聖方濟各堂區','三級',115,15.0,'健康',22.134377,113.581946),
('31',9,123,'聖方濟各堂區','三級',115,15.0,'健康',22.134566,113.582545),
('32',9,123,'聖方濟各堂區','三級',115,15.0,'健康',22.133937,113.582166),
('1083',9,121,'聖方濟各堂區','三級',115,15.0,'健康',22.117492,113.552073),
('178',9,106,'聖方濟各堂區','三級',115,14.1,'健康',22.115998,113.552065),
('823',9,46,'大堂區','三級',115,14.0,'健康',22.193129,113.542879),
('863',52,39,'望德堂區','三級',115,14.0,'健康',22.200045,113.549629),
('1056',9,60,'大堂區','三級',115,14.0,'健康',22.192511,113.552293);
insert into public.trees (tree_no,species_id,site_id,parish_code,grade,age_years,height_m,health,lat,lon) values
('1101',11,40,'花王堂區','三級',115,14.0,'健康',22.197017,113.541627),
('508',34,65,'花王堂區','三級',115,14.0,'健康',22.195947,113.548038),
('719',9,52,'花地瑪堂區','三級',115,14.0,'健康',22.204809,113.551012),
('896',39,28,'風順堂區','三級',115,14.0,'健康',22.1879,113.5378),
('141',9,114,'聖方濟各堂區','三級',115,14.0,'健康',22.114959,113.55106),
('142',9,114,'聖方濟各堂區','三級',115,14.0,'健康',22.11518,113.550472),
('143',9,114,'聖方濟各堂區','三級',115,14.0,'健康',22.115448,113.551297),
('144',9,114,'聖方濟各堂區','三級',115,14.0,'健康',22.114543,113.550759),
('375',9,24,'風順堂區','三級',115,13.0,'健康',22.187407,113.535063),
('622',9,9,'嘉模堂區','三級',115,13.0,'健康',22.151608,113.556058),
('1054',52,34,'大堂區','三級',115,13.0,'健康',22.192313,113.544841),
('1086',21,11,'嘉模堂區','三級',115,13.0,'健康',22.165126,113.559125),
('1126',21,14,'嘉模堂區','三級',115,13.0,'健康',22.162069,113.562376),
('122',9,112,'聖方濟各堂區','三級',115,13.0,'健康',22.118683,113.551352),
('140',9,114,'聖方濟各堂區','三級',115,13.0,'健康',22.115282,113.550874),
('145',9,114,'聖方濟各堂區','三級',115,13.0,'健康',22.115766,113.550449),
('146',9,114,'聖方濟各堂區','三級',115,13.0,'健康',22.114925,113.551764),
('33',9,123,'聖方濟各堂區','三級',115,13.0,'健康',22.13477,113.581959),
('640',9,19,'嘉模堂區','三級',115,12.0,'健康',22.161045,113.55875),
('780',20,25,'望德堂區','三級',115,12.0,'健康',22.200148,113.550973),
('1004',9,58,'風順堂區','三級',115,12.0,'健康',22.18596,113.537188),
('1018',9,58,'風順堂區','三級',115,12.0,'健康',22.185778,113.53724),
('1019',9,58,'風順堂區','三級',115,12.0,'健康',22.186419,113.536932),
('1026',9,58,'風順堂區','三級',115,12.0,'健康',22.185689,113.537066),
('123',9,112,'聖方濟各堂區','三級',115,12.0,'健康',22.118485,113.549751),
('7',56,96,'聖方濟各堂區','三級',115,12.0,'健康',22.134968,113.582361),
('138',16,116,'聖方濟各堂區','三級',115,12.0,'健康',22.114566,113.550245),
('28',9,123,'聖方濟各堂區','三級',115,12.0,'健康',22.134201,113.582396),
('893',2,70,'風順堂區','三級',115,11.0,'健康',22.187187,113.535833),
('1003',9,58,'風順堂區','三級',115,11.0,'健康',22.186254,113.537375),
('1016',9,58,'風順堂區','三級',115,10.0,'健康',22.186103,113.536858),
('1017',9,58,'風順堂區','三級',115,10.0,'健康',22.186419,113.537472),
('1020',9,58,'風順堂區','三級',115,10.0,'健康',22.186129,113.537653),
('57',25,118,'聖方濟各堂區','三級',115,10.0,'健康',22.122441,113.559494),
('111',9,115,'聖方濟各堂區','三級',115,10.0,'健康',22.121265,113.553496),
('431',34,68,'花王堂區','三級',115,9.0,'健康',22.200758,113.538462),
('1022',9,58,'風順堂區','三級',115,9.0,'健康',22.186568,113.537285),
('786',32,25,'望德堂區','三級',115,8.0,'健康',22.200831,113.550932),
('829',54,36,'大堂區','三級',115,8.0,'健康',22.191838,113.544234),
('899',13,86,'風順堂區','三級',115,8.0,'健康',22.187958,113.535036),
('100',9,98,'聖方濟各堂區','三級',115,7.01,'健康',22.118127,113.551716),
('785',47,25,'望德堂區','三級',115,7.0,'健康',22.199412,113.551293),
('52',27,118,'聖方濟各堂區','三級',115,7.0,'健康',22.122057,113.558763),
('42',9,107,'聖方濟各堂區','三級',115,15.0,'瀕危',22.126699,113.559187),
('18',16,96,'聖方濟各堂區','三級',115,12.0,'瀕危',22.134045,113.58178),
('279',17,57,'望德堂區','三級',115,8.0,'瀕危',22.198316,113.55236),
('966',9,43,'風順堂區','三級',115,3.5,'瀕危',22.183926,113.530479),
('873',17,59,'望德堂區','三級',113,15.0,'一般',22.19938,113.549435),
('139',9,116,'聖方濟各堂區','三級',113,13.0,'一般',22.113802,113.550867),
('1133',10,127,'聖方濟各堂區','三級',107,15.0,'一般',22.113,113.562),
('68',9,120,'聖方濟各堂區','三級',106,12.0,'健康',22.115344,113.555732),
('549',9,4,'嘉模堂區','三級',103,18.0,'一般',22.152862,113.558602),
('550',9,4,'嘉模堂區','三級',103,17.0,'一般',22.153301,113.557324),
('67',40,7,'嘉模堂區','不分級',35,10.01,'健康',22.160635,113.5545),
('1131',26,31,'大堂區','不分級',33,14.0,'一般',22.192728,113.549094),
('66',40,7,'嘉模堂區','不分級',25,9.01,'健康',22.160224,113.554773),
('1132',40,7,'嘉模堂區','三級',14,6.01,'一般',22.160554,113.55384),
('1135',40,7,'嘉模堂區','不分級',6,3.5,'健康',22.161019,113.555231);

-- 路綫
insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,max_stops,sort_order,tips) values ('macau-heritage-core','路綫一：澳門半島歷史城區古樹徑','由白鴿巢公園出發，經大炮台、盧廉若公園、加思欄花園到媽閣廟前地，一次走完半島舊城區最集中的古樹群。',ARRAY['花王堂區', '望德堂區', '大堂區', '風順堂區']::text[],ARRAY['澳門區白鴿巢公園', '澳門區大炮台公園', '澳門區盧廉若公園', '澳門區加思欄花園', '澳門區何東圖書館', '澳門區媽閣廟前地', '澳門區媽閣上街', '澳門區亞婆井前地', '澳門區主教山小堂', '澳門區鄭家大屋', '澳門區崗頂劇院']::text[],'榕屬、海南蒲桃、鳳凰木',10,1,'全程步行，建議早上出發；公園開放時間內進入；勿踩踏樹根與攀爬樹幹。');
insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,max_stops,sort_order,tips) values ('macau-north-parks','路綫二：北區公園與山邊古樹徑','松山市政公園、二龍喉公園、螺絲山公園、望廈山市政公園與青洲山，觀察山體與泉水如何養活古樹。',ARRAY['花地瑪堂區', '望德堂區']::text[],ARRAY['澳門區松山市政公園', '澳門區二龍喉公園', '澳門區螺絲山公園', '澳門區望廈山市政公園', '澳門區青洲山', '澳門區觀音古廟', '澳門區普濟禪院（觀音堂）', '澳門區馬交石炮台馬路']::text[],'榕樹、樟樹、羅漢松',8,2,'松山路段有坡度，建議穿運動鞋；觀音古廟內有全澳最老古樹（515 年海南蒲桃）。');
insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,max_stops,sort_order,tips) values ('taipa-carmo','路綫三：氹仔嘉模與龍環葡韻古樹徑','嘉模斜巷、龍環葡韻一帶、益隆炮竹廠、小潭山環山徑，看葡式住宅與假菩提樹組成的地景。',ARRAY['嘉模堂區']::text[],ARRAY['氹仔區嘉模斜巷', '氹仔區關帝殿及天后宮', '氹仔區益隆炮竹廠', '氹仔區嘉路士米耶馬路', '氹仔區飛能便度街', '氹仔區菜園路', '氹仔區小潭山2000環山徑', '氹仔區徐日昇寅公馬路']::text[],'假菩提樹（心葉榕）、樟樹',8,3,'適合親子；龍環葡韻一帶有洗手間與飲水機；環山徑全程約 2 公里。');
insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,max_stops,sort_order,tips) values ('coloane-wild','路綫四：路環郊野與村落古樹徑','石排灣郊野公園、九澳聖母馬路、黑沙海灘公園、路環舊市區十月初五馬路——全澳古樹最密集的一條路綫。',ARRAY['聖方濟各堂區']::text[],ARRAY['路環區石排灣郊野公園', '路環區九澳聖母馬路', '路環區九澳村路', '路環區黑沙海灘公園', '路環區竹灣馬路', '路環區十月初五馬路', '路環區恩尼斯總統前地', '路環區船人街', '路環區石街', '路環區打纜街', '路環區鮑思高青年村', '路環區譚公廟前地']::text[],'假菩提樹（心葉榕）、龍眼、華潤楠',12,4,'建議乘巴士至石排灣起步；郊野路段注意防曬與補水；黑沙海灘可作終點。');
insert into public.routes (code,name_zh,summary,parish_codes,site_names,species_focus,max_stops,sort_order,tips) values ('oldest-trees','路綫五：全澳最老古樹巡禮','不按地區，只按樹齡——把全澳最老的十株古樹串成一條路綫，包括 515 年的海南蒲桃。','{}','{}','海南蒲桃、假菩提樹、樟樹',10,5,'此路綫橫跨半島與離島，建議分兩日；實際停靠點由系統按樹齡最高的個體自動選出。');

-- 保育科普
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('why-conserve','為何保育','為什麼要保育「古樹」？對現在與將來的意義','古樹不只是老樹：它是城市裡唯一「活着」的歷史文物，同時提供降溫、固碳、滯塵與生物棲地等生態服務。','## 一、古樹是「不可複製」的文化遺產

澳門《文化遺產保護法》第 106 條把「古樹名木」與紀念物、建築群、場所並列為受保護的文化遺產，定義是：

> 因**樹齡逾一百年**、**樹種珍貴**、**樹形奇特**、**稀有**，或**具特殊的歷史或文化意義**而列入《古樹名木保護名錄》的樹木。

一棵 515 年的海南蒲桃（位於觀音古廟）經歷了明代、葡萄牙人東來、開埠、抗戰、回歸——它活着的時候，我們腳下的城市被建了又拆、拆了又建。這種「時間尺度」的見證，是任何博物館展品都無法代替的。

## 二、對「現在」的意義

| 面向 | 具體作用 |
| --- | --- |
| 生態 | 成年大樹的樹冠體積是小樹的數十倍，降溫、遮蔭、滯塵、吸收噪音的效果遠勝新植樹苗 |
| 固碳 | 樹木碳儲量與生物量（約與樹高、樹冠體積相關）成正比，一棵古樹等於一座小型碳庫 |
| 生物多樣性 | 老樹的樹洞、樹皮裂縫、板根是蝙蝠、鳥類、昆蟲、蕨類與苔蘚的棲地 |
| 社會 | 廟宇、教堂前的古樹是街坊的地標與共同記憶的錨點，構成社區認同 |
| 旅遊 | 市政署正研究打造**古樹主題旅遊路綫**，把古樹由「綠化資產」變成「文化旅遊資產」 |

## 三、對「將來」的意義

1. **氣候調適**：在極端高溫與暴雨更頻繁的未來，成熟的樹冠是城市最便宜、最有效的降溫與雨水滯蓄設施。
2. **基因庫**：澳門古樹中不少是本地原生或早期引種成功馴化的個體，其基因型對未來城市林業育種有價值。
3. **不可逆性**：古樹一旦死亡或移除，**無法用金錢買回**。種一棵新樹要等 100 年才可能成為「古樹」，所以保育的第一原則永遠是「保住現有的」。
4. **教育**：把名錄變成數據、把數據變成故事，是讓下一代認識古樹的橋樑。

## 四、一句話總結

> 保育古樹不是為了樹，而是為了把城市的時間記憶留在原地——現在享有它，將來才有資格談「歷史」。',ARRAY['第11/2013號法律《文化遺產保護法》第106條（澳門特別行政區公報第36期第一組，2013-09-02）', '市政署：澳門古樹名木保育工作（新華社報導，2025-03-16）', '市政署與廣州市林業和園林科學研究院《澳門古樹名木技術支援協議書》（2025）']::text[],1);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('distribution','分佈與歷史','古樹在澳門的分佈（生物與地理角度）','古樹高度集中在舊城區的廟宇、教堂、花園，以及離島的郊野公園與村落——分佈由「歷史開發」與「物種生態需求」兩股力量共同決定。','## 一、地理角度：古樹住在哪裡？

把 658 筆紀錄按堂區統計，會看到明顯的「三圈結構」：

1. **半島舊城圈**：風順堂區、花王堂區、大堂區、望德堂區、花地瑪堂區。這是葡萄牙人 1557 年落腳後最早開發的區域。白鴿巢公園（始建於 18 世紀 70 年代，是澳門歷史最悠久的公園之一）、盧廉若公園、加思欄花園、松山市政公園、二龍喉公園、大炮台公園等，都保有大量百年以上的老樹。
2. **離島郊野圈**：聖方濟各堂區（路環）數量最多。石排灣郊野公園、黑沙海灘公園、九澳聖母馬路、竹灣馬路等，因為**未被高密度城市化覆蓋**，土壤空間與水分條件完整，古樹得以存活成林。
3. **氹仔與填海新區圈**：嘉模堂區與路氹填海區。數量較少，多沿嘉模斜巷、益隆炮竹廠、小潭山環山徑等舊聚落邊緣或山邊分佈。

## 二、生物角度：為什麼是這些樹？

| 生態因子 | 說明 |
| --- | --- |
| 樹種壽命 | 榕屬（心葉榕／假菩提樹、榕樹、高山榕）、樟樹、海南蒲桃、龍眼等本身就是長壽樹種；速生與短壽樹種難以活過百年 |
| 根系策略 | 榕樹的**氣生根**與**板根**能繞過硬質鋪面開拓空間，在狹窄的城市縫隙中仍可立足 |
| 萌芽力 | 榕屬萌芽力強，枝幹受損後易萌發新枝，抗逆性高 |
| 人為保護 | 種在廟宇、教堂、宅邸庭園的樹，歷史上被視為「風水樹」「神樹」，被人主動保護 |
| 立地條件 | 有土、有水、不積澇、不被路面封死的「軟質地面」是關鍵 |

## 三、分佈特徵總結

- **高度集中（聚集型分佈）**：少數地點就佔了全澳古樹的相當比例，呈顯著的聚集型分佈（clustered pattern），而非隨機分佈。
- **與宗教信仰空間高度重疊**：廟宇（媽閣廟、普濟禪院／觀音堂、蓮峯廟、觀音古廟、譚公廟）、教堂與墳場（望廈聖方濟各聖堂、嘉模市政墳場等）周邊密度遠高於一般街區。
- **與「非建設用地」正相關**：公園、郊野、山邊、舊村落邊界是高密度區。
- **沿海岸與舊馬路呈線狀排列**：如民國大馬路（半島）、民國馬路（路環）、十月初五馬路、竹灣馬路，屬歷史上沿海交通與居住帶。
- **離島「總量大、樹種窄、平均樹齡高」，半島「總量分散、樹種多、個體健康壓力大」**——這是保育策略必須分開處理的理由。',ARRAY['本平台資料庫（658 筆古樹名錄紀錄：堂區／地點／品種／樹齡／樹高／健康狀況）', '市政署古樹名木名錄統計（新華社報導，2025-03-16）']::text[],2);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('history-link','分佈與歷史','澳門歷史背景與現存古樹的關聯：為何在「那個時段」出現？','每一株古樹的樹齡都是一個歷史事件的回聲：開埠、明清廟宇建設、18–19 世紀花園宅邸、填海與馬路開闢，以及 1970 年代後的郊野保育。','## 一、用樹齡「回推」歷史時段

古樹的樹齡可以粗略換算成種植年代（以 2026 年為基準）：

| 樹齡區間 | 種植年代（約） | 歷史背景 | 對應典型地點 |
| --- | --- | --- | --- |
| 400–520 年 | 1500–1620 年代 | 開埠前後、明代廟宇與聚落形成 | 觀音古廟、媽閣廟一帶 |
| 300–400 年 | 1620–1720 年代 | 明清交替、對外貿易興盛、村落擴張 | 路環舊村、九澳 |
| 200–300 年 | 1720–1820 年代 | 廟宇重修、華人聚居區成形 | 普濟禪院、蓮峯廟、亞婆井 |
| 100–200 年 | 1820–1920 年代 | 花園宅邸、教堂與墳場、填海與新馬路開闢 | 白鴿巢公園、盧廉若公園、加思欄花園、龍環葡韻一帶 |

## 二、為什麼集中在那些地點？

1. **宗教與宗族空間的「免疫作用」**：廟宇、教堂、墳場、祠堂屬社區共同擁有的神聖空間，歷史上不容易被拆遷改動，樹因此得以「原地不動」地長大。
2. **歐式花園與宅邸的引種**：18–19 世紀，葡人與華商在澳門興建花園住宅，主動引入觀賞樹種（木棉、鳳凰木、白蘭、羅漢松等），今日的「百年名木」很多就是當年引種的後代。
3. **物種交換的樞紐**：歷史上外商對澳門的植物群很感興趣，把在此採集的種子與標本寄往歐洲，也把植物引入澳門——東西方物種在此中轉、交匯，再向外傳播。這解釋了澳門古樹名錄的**樹種多樣性**。
4. **1960–1980 年代的郊野保護**：路環石排灣、小潭山、九澳一帶被劃作郊野公園與綠化區，避免了高密度開發，形成今日最大的古樹群。
5. **填海區的「零古樹」**：路氹填海區、新城填海區是近數十年才成陸，自然不可能有百年樹木——這是「為何新區古樹少」最直接的答案。

## 三、一個關鍵推論

> 古樹的分佈，其實是**澳門土地利用歷史的地圖**。哪裡今天有古樹，哪裡就是「未被反覆重建的土地」。

因此，古樹名錄不只是一份植物清單，也是一份「城市記憶的空間索引」。',ARRAY['本平台資料庫樹齡分佈（名錄最大樹齡 515 年，位於澳門區觀音古廟）', '市政署／新華社：澳門古樹名木及其保育工作者（2025-03-16）', '第11/2013號法律及第4/2024號行政法規（澳門歷史城區保護及管理計劃）']::text[],3);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('conditions','管護技術','保育古樹需要什麼條件？','古樹存活的條件可分為「立地條件」、「技術條件」與「制度條件」三層，缺一不可。','## 一、立地條件（樹能不能活着）

| 條件 | 具體要求 | 常見破壞來源 |
| --- | --- | --- |
| 土壤空間 | 根系多集中在表層 60 cm 內，需要透氣、透水、不被壓實的土壤 | 鋪水泥、鋪磚、車輛碾壓、堆放建材 |
| 水分與排水 | 穩定的地下水補給，同時不長期積澇 | 渠道改道、地面硬化令雨水無法下滲、地下工程抽水 |
| 光照 | 樹冠需要充足光照維持光合作用 | 鄰近新建高樓遮擋 |
| 空間 | 樹冠與枝幹需有伸展與避讓空間 | 電纜、招牌、外牆、圍欄剪切樹冠 |
| 不被干擾 | 樹頭與骨幹根不得任意挖斷 | 道路擴闊、鋪設管線、改建工程 |

## 二、技術條件（人能不能照顧好）

- **定期巡查**：市政署對健康的古樹**每年最少巡查兩次**、健康狀況一般的**每季最少一次**、瀕危古樹**每月一次**並視情況加密。
- **無損檢測**：以目測樹冠、樹幹、根部作初步判斷；需要深入了解時使用**斷層檢測儀**檢查主幹內部腐朽情況。
- **樹體修復**：裂縫填充、樹洞處理、支撐與拉索、根部復壯、病蟲害防治——市政署並為技術人員開辦「古樹名木樹體修復技術課程」。
- **跨地域技術支援**：市政署與**廣州市林業和園林科學研究院**簽署《澳門古樹名木技術支援協議書》，專家於 2025 年先後 4 次來澳，提供風險評估、病蟲害防治等支援。

## 三、制度條件（社會願不願意）

1. **法定名錄**：只有載入《古樹名木保護名錄》的樹木才享有法律上的禁止砍伐、禁止移植保護。
2. **責任分工**：名錄樹木的所有人／持有人有維護義務，遇有破損風險須立即通知文化局或具職權維護樹木的公共部門，並可要求技術支援。
3. **公眾教育**：市政署透過社區活動、學校課程、講座推廣，並為古樹掛上附**二維碼**的「身份證」，掃碼即可查閱樹種、樹齡、健康情況與形態特徵。
4. **社區參與**：居民舉報、攝影記錄、志願巡查，是最低成本、覆蓋面最廣的監測網。

## 四、檢查清單（一株古樹的健康條件）

- [ ] 樹冠完整、無異常落葉或枯梢
- [ ] 主幹無明顯裂縫、腐朽、空洞或菌類子實體
- [ ] 根部無被土壤覆蓋過深、無被鋪面封死
- [ ] 無嚴重病蟲害或藤蔓纏繞
- [ ] 周邊無施工、無堆積、無車輛停放
- [ ] 已掛牌登記、有 QR 可查',ARRAY['市政署古樹名木巡查與管護制度（新華社報導，2025-03-16）', '第11/2013號法律《文化遺產保護法》第106條（所有人維護義務、禁止移植與砍伐）']::text[],4);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('legislation','立法與制度','何時立法保護古樹？澳門古樹保護的制度史','2013 年《文化遺產保護法》把古樹名木寫進法律（2014 年生效），2016 年首次核准《古樹名木保護名錄》，此後多次更新至 2026 年。','## 一、時間線

| 年份 | 事件 |
| --- | --- |
| 1984 | 第 56/84/M 號法令，澳門首次系統保護「紀念物、建築群及場所」（未直接涵蓋樹木） |
| 1992 | 第 83/92/M 號法令，擴充受保護不動產清單 |
| **2013** | **第 11/2013 號法律《文化遺產保護法》於 9 月 2 日刊登**，第 106 條首次把「古樹名木」定義為文化遺產的一類 |
| **2014** | **《文化遺產保護法》於 3 月 1 日生效** |
| **2016** | 第 333/2016 號行政長官批示，**首次核准《古樹名木保護名錄》**（10 月 5 日） |
| 2020 | 第 130/2020 號、第 216/2020 號行政長官批示更新名錄 |
| 2021 | 第 168/2021 號行政長官批示更新名錄 |
| 2024 | 第 118/2024 號行政長官批示（7 月 22 日）更新名錄 |
| 2026 | 第 279/2025 號行政長官批示（1 月 5 日刊登）核准**現行**《古樹名木保護名錄》 |

## 二、法律給了古樹什麼保護？

1. **定義與名錄**：古樹名木由具職權維護樹木的公共部門評估、擬訂、更新名錄，並以行政長官批示核准公佈。
2. **禁止行為**：禁止拔除、砍伐或以任何方式毀損古樹名木的全部或部分；**禁止移植或移除**名錄內任何樹木。
3. **唯一例外**：屬「維護」行為，或涉及**重大公共利益**，或由具職權部門宣告為**預防危害公眾安全**時採取的措施。
4. **所有人的義務**：名錄樹木的所有人、持有人、佔有人須維護樹木；發現可能導致樹木破損、毀壞或滅失的情況，須**立即通知**文化局或具職權維護樹木的公共部門。
5. **配套**：第 4/2024 號行政法規訂定「澳門歷史城區」保護及管理計劃，古樹常位於其緩衝區內，受到雙重保護。

## 三、法律的局限（值得思考）

- 名錄是「列舉式」保護：**名錄以外的老樹不受同等保護**，而新樹要等 100 年才有機會入列。
- 保護的重心在「禁止」而非「投入」：日常管護的資源、人力與技術培訓仍是長期挑戰。
- 城市發展壓力：「重大公共利益」例外的判斷，往往涉及工程、交通與保育之間的張力。',ARRAY['第11/2013號法律《文化遺產保護法》，2013-09-02 刊登，2014-03-01 生效', '第333/2016號行政長官批示：首次核准《古樹名木保護名錄》（2016-10-05）', '第118/2024號、第279/2025號行政長官批示：更新《古樹名木保護名錄》']::text[],5);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('residents','居民與社區','古樹對附近居民的影響：正面與負面都要誠實面對','古樹同時是「公共財」與「風險源」：樹蔭、降溫、認同感是收益；板根破壞路面、枯枝墜落、落果與蚊患是成本。','## 一、正面影響

- **微氣候**：樹冠遮蔭令樹下地表溫度顯著低於曝曬路面，是澳門夏季最有效的天然降溫設施。
- **空氣與噪音**：葉面滯塵、吸收部分氣態污染物；枝葉吸收與散射噪音。
- **心理健康與社交**：公園古樹下是晨運、下棋、閒談的固定場所，是社區的「公共客廳」。
- **身份認同**：白鴿巢公園的榕樹、觀音古廟的海南蒲桃、盧廉若公園的樹群，是居民口中的「地標」「我們的樹」。
- **物業與旅遊價值**：樹蔭良好的街區、有古樹的庭園，是澳門舊城區重要的景觀資產。

## 二、負面影響（不能只講好話）

| 問題 | 成因 | 現行處理方式 |
| --- | --- | --- |
| 枯枝墜落傷人損物 | 老樹枝幹腐朽、颱風吹折 | 風險評估＋修剪；瀕危者每月巡查；必要時依法律例外規定採取預防措施 |
| 板根抬起路面、破壞渠道 | 榕屬根系發達、鋪面過於貼樹 | 樹穴擴大、透水鋪面、設置護根欄 |
| 落果、落葉、樹液弄污 | 龍眼、芒果、榕果等結實 | 定期清掃、結果期集中清理 |
| 遮擋陽光、通風差 | 樹冠密、樓距近 | 專業修剪（忌過度修剪） |
| 蚊蟲與動物聚集 | 樹洞積水、果實吸引 | 樹洞排水處理、環境衛生管理 |
| 過敏（花粉） | 花期集中 | 公眾資訊提示 |
| 妨礙工程與交通 | 樹位與管線、行車道衝突 | 個案討論：改線、改道優先於移樹 |

## 三、共存的關鍵

> 居民對古樹的態度，取決於**風險是否被妥善管理**。透明公佈巡查與風險評估結果、讓居民參與，是把「鄰避」變成「鄰愛」的關鍵。

這也是澳門近年「為古樹掛牌＋QR 碼上網」的價值：把資訊公開，讓每個人都是監督者。',ARRAY['市政署巡查制度（健康／一般／瀕危分級巡查與風險評估）', '第11/2013號法律第106條：為預防危害公眾安全而採取措施之例外規定']::text[],6);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('future','管護技術','為何未來古樹會越來越多？又該如何應對？','「越來越多」不是自然會發生，而是三個機制疊加的結果：樹木持續跨過 100 年門檻、名錄持續擴充、城市綠化存量累積——前提是今天的新樹在 100 年後仍然存在。','## 一、為什麼未來會越來越多？三個機制

1. **樹木跨越 100 年門檻**：樹齡只是門檻之一。今天 60–99 歲的樹，在未來 40 年內陸續「合資格」進入名錄。名錄的規模因此有內在的成長動能。
2. **名錄本身在擴充**：從 2016 年首次核准到 2026 年，名錄已經歷多次更新（333/2016 → 130/2020 → 216/2020 → 168/2021 → 118/2024 → 279/2025），每次更新都納入新認定或新發現的古樹。
3. **城市綠化存量累積**：澳門自 1980 年代以來持續增加公園、行道樹與郊野綠化（石排灣郊野公園、小潭山、黑沙水庫健康徑等），這些樹木今天年輕，但正是未來古樹的「人才庫」。

## 二、反面條件：什麼會讓古樹變少？

- 樹木死亡率：健康狀況「瀕危」的個體佔比愈高，未來退出名錄的速度愈快。
- 立地喪失：工程、鋪面、地下開發對根系與土壤的不可逆破壞。
- 極端天氣與病蟲害：颱風、暴雨、褐根病等。
- 管護資源不足：巡查頻率跟不上古樹數量成長。

## 三、應對方法（由近到遠）

| 層次 | 措施 |
| --- | --- |
| 數據 | 建立**動態電子名錄**：每一株的位置、樹齡、樹高、健康狀況、巡查與維修紀錄全部數位化（就像本平台） |
| 風險 | 全樹木風險評估（VTA）分級，瀕危者加密巡查；颱風前預警修剪 |
| 立地 | 樹穴透水化、禁止鋪面壓實、管線繞樹、工程前的根系調查 |
| 技術 | 斷層檢測、土壤改良、根部復壯、結構支撐；持續與內地科研單位合作培訓技術人員 |
| 制度 | 名錄定期更新常態化；把「古樹後備名錄」制度化，令「準古樹」提前納入監測 |
| 社會 | 掛牌＋QR、社區認養、學校護樹課程、古樹主題旅遊路綫 |
| 規劃 | 城市規劃階段就納入古樹保育，避免「先設計、後發現」的被動局面 |

## 四、一句話

> 未來古樹變多不是運氣，而是**今天的每一項管護決策**的結果。',ARRAY['《古樹名木保護名錄》歷次更新（2016、2020、2021、2024、2026）', '本平台數學模型：樹齡分佈與存續分析（見「數學角度分析」）', '市政署 2025 年度施政方針：更新古樹名錄加強管護']::text[],7);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('stories','分佈與歷史','古樹與地方的故事','白鴿巢公園、觀音古廟、盧廉若公園、龍環葡韻、石排灣郊野公園、媽閣廟——每一處的名字背後，都有一株樹在記帳。','## 1. 觀音古廟（花地瑪堂區）——最老的一株

名錄中樹齡最高者：**海南蒲桃，樹齡約 515 年**，健康狀況為「瀕危」。同處另有 495 年與 365 年的個體。五百年的樹站在廟前，本身就是廟宇歷史的實物證據。

## 2. 白鴿巢公園（花王堂區）——澳門最老的公園之一

始建於 **18 世紀 70 年代**，園內有假菩提樹（心葉榕）、海南蒲桃、鳳凰木等古樹，樹上掛有附 QR 碼的「身份證」。園內林木參天、鬱鬱葱葱，拾級而上，隨手可掃碼讀一株樹的一生。

## 3. 盧廉若公園（望德堂區）——華商園林的遺產

建於 19 世紀末的蘇州式園林，是澳門華商盧九家族的產業。園內百年樹木與曲橋、假山、亭台共同構成完整的嶺南園林景觀，說明古樹從來不是「單獨存在」，而是整個場所的一部分。

## 4. 松山市政公園與二龍喉公園——山與泉的記憶

松山（東望洋山）是澳門半島最高的山，19 世紀後山上陸續興建東望洋燈塔與炮台。二龍喉公園前身為 19 世紀葡人園邸「二龍喉花園」。這一區的古樹群說明：**山體與泉水，是古樹長期存活的地下水保證**。

## 5. 龍環葡韻一帶（嘉模堂區）——最常被拍照的一株

氹仔龍環葡韻附近的**假菩提樹**，是媒體報導澳門古樹時的常客。它所在的位置正是 1921 年建成的五幢葡式住宅前方，樹與建築共同構成澳門最著名的地景之一。

## 6. 石排灣郊野公園（聖方濟各堂區）——全澳最大的古樹聚落

路環石排灣郊野公園是古樹數量最多的地點之一，以假菩提樹為主。郊野公園的土地性質（非建設用地）是它能保存整片古樹林的制度原因。

## 7. 媽閣廟與亞婆井——海與泉的節點

媽閣廟是「Macau」一名的重要來源地，廟前與附近的古樹（榕樹類為主）與媽閣上街、亞婆井前地的百年街區一起，保存在澳門歷史城區的緩衝區內。

## 共同點

> 每一個古樹故事的共同結構都是：**一個不會被拆的地方**（廟、教堂、公園、郊野）＋**一個不被打擾的根系**（泉水、山體、非建設用地）＋**一群在乎它的人**。',ARRAY['新華社：守護記憶的枝葉——記澳門古樹及其保育工作者（2025-03-16）', '本平台資料庫：各處古樹的品種、樹齡與健康狀況']::text[],8);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('math-analysis','數學與數據','數學角度：用統計模型分析樹齡、樹高與品種的關係','以 658 筆名錄資料作迴歸與變異數分析，結果出人意表：樹齡幾乎不能解釋樹高，品種才是主導因子——這個「失敗的擬合」本身就是重要發現。','## 一、變數與資料

- 自變數 $x$：樹齡（年）
- 應變數 $y$：樹高（米）
- 分組變數：品種（56 種）、堂區（8 個）
- 樣本量 $n = 658$

## 二、模型比較（最小平方法）

本平台即時擬合以下模型，並以**決定係數 $R^2$** 與 **RMSE** 比較：

| 模型 | 形式 | 參數 |
| --- | --- | --- |
| 線性 | $y = a + bx$ | 2 |
| 對數 | $y = a + b\ln x$ | 2 |
| 冪律 | $y = a\,x^{b}$ | 2 |
| 飽和指數 | $y = A\left(1 - e^{-kx}\right)$ | 2（牛頓法非線性擬合） |
| 品種啞變數多元迴歸 | $y = a + bx + \sum_i c_i D_i$ | $6 + k$ |

## 三、結果與解釋

- 樹齡與樹高的**皮爾森相關係數接近 0**（線性、對數關係皆然）。
- 這**不是資料錯誤**，而是生物學上的合理結果：**樹高主要由基因（品種）與立地條件決定**；樹齡決定的是樹的「粗度、材積與碳儲量」，而不是單純高度——一棵 100 年的榕樹與一棵 300 年的龍眼，誰高誰矮取決於誰是榕樹。
- 因此本研究改以**單因子變異數分析（one-way ANOVA）**檢驗「品種」對樹高的解釋力，並以 $\eta^2$（品種可解釋的變異比例）與樹齡的 $R^2$ 作對照：

$$F = \frac{MS_{組間}}{MS_{組內}} = \frac{SS_{組間}/(k-1)}{SS_{組內}/(n-k)}$$

## 四、由數據導出的三個結論

1. **【擬合方法】**單一自變數的簡單迴歸不足以解釋樹高，必須引入類別變數（品種）或改用「材積／碳儲量」作為應變數。
2. **【保育政策】**不能只用樹齡排優先次序：一株 100 年、健康狀況「瀕危」的稀有品種，其保育價值可能高於一株 300 年、健康狀況「健康」的常見品種。
3. **【統計顯著性】**堂區之間的樹齡與健康差異，可用卡方檢定與變異數分析檢驗，以判斷「半島古樹承受的健康壓力」是否在統計上顯著（見本平台「數據分析」頁）。

## 五、延伸：未來古樹數量的預測模型

以名錄現況為基礎的**存續模型**：

$$N(t) = N_0 \cdot S(t) + G(t)$$

- $S(t)$：存活率函數，由各健康等級的年度風險率（健康 0.5%／一般 1.5%／瀕危 6%）估算
- $G(t)$：新增晉級樹木，由樹齡接近 100 年的個體數與名錄擴充歷史趨勢估算

> ⚠️ 此為**模型估計**，用以展示「未來古樹為何會增加／何時會減少」的數學機制，並非官方預測。',ARRAY['本平台資料庫 658 筆古樹紀錄（樹齡、樹高、品種、堂區、健康狀況）', '演算法實作：/api/stats（最小平方法、牛頓法非線性擬合、單因子變異數分析）']::text[],9);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('extras','常見問題','想補充的相關知識：古樹名木的專業常識','樹齡怎麼算？分級怎麼分？什麼是樹木風險評估、斷層檢測、生物力學與碳儲量？一次補齊。','## 1. 古樹名木的分級標準

| 級別 | 樹齡 |
| --- | --- |
| 一級古樹 | 500 年以上 |
| 二級古樹 | 300–499 年 |
| 三級古樹 | 100–299 年 |
| 名木 | 不受樹齡限制，因珍貴、稀有、樹形奇特或具特殊歷史文化意義而列入 |

（本平台資料顯示：一級 1 株、二級 6 株、三級 647 株、不分級 4 株。）

## 2. 樹齡是怎麼測出來的？

| 方法 | 原理 | 優缺點 |
| --- | --- | --- |
| 文獻與口述 | 廟宇、教堂、宅邸的興建與種植紀錄 | 便宜，但常只能給出區間 |
| 生長錐／年輪 | 鑽取樹芯數年輪（樹輪年代學） | 準確，對古樹有侵入風險，多用於已倒木 |
| 無損年輪探測 | 應力波／電阻／微鑽阻力儀（Resistograph） | 半定量，可掃描內部腐朽 |
| 斷層檢測儀 | 聲波／應力波斷層成像，重建主幹內部結構 | 市政署實際使用的方法之一 |
| 迴歸模型估算 | 以已知樹齡樣本建立「胸徑／樹高—樹齡」迴歸式推算 | 用於無法直接測齡的個體 |

## 3. 樹木風險評估（VTA）

Visual Tree Assessment：以目測檢查樹幹、根盤、枝幹的力學缺陷（裂縫、腐朽、空洞、菌類子實體、根盤隆起），配合儀器檢測，輸出「風險等級 → 處置建議（觀察／修剪／支撐／加固／必要時移除）」。市政署的健康等級（健康／一般／瀕危）與巡查頻率（每年兩次／每季一次／每月一次）就是風險管理的落地版本。

## 4. 生物力學小知識

- **樹冠風阻**：樹冠受風力與面積成正比，故老樹在颱風季的風險集中在「樹冠—主幹—根盤」三個連結處。
- **板根與氣生根**：榕屬以板根擴大支撐面積、以氣生根形成「樹包樹」「獨木成林」，是它能在城市狹縫中生存的力學與生理基礎。
- **應力木（reaction wood）**：樹木會針對長期受力方向生長「拉力木／壓力木」自我加固，因此突然移除一邊的樹冠，反而破壞它原有的力學平衡。

## 5. 碳儲量估算（把古樹量化為生態服務）

以簡化異速生長式估算地上生物量：

$$AGB \approx a \cdot (D^2 H)^{b}$$

其中 $D$ 為胸徑、$H$ 為樹高；含碳量約為乾重的 47%–50%，再乘 $44/12$ 換算為二氧化碳當量。以本資料的樹高分佈估算，成年大樹的單株碳儲量可達小樹的數十倍——這是「保育古樹＝低成本固碳」的量化依據。

## 6. 常見誤解

- ❌「老樹就等於古樹」→ 要同時符合樹齡／珍貴／稀有／歷史文化意義並**列入名錄**。
- ❌「樹死了可以再種一棵一樣的」→ 位置、生態功能與歷史關聯都無法複製。
- ❌「修剪越多越安全」→ 過度修剪會破壞力學平衡、引發萌發枝（結構弱枝）與腐朽。
- ❌「樹根會破壞地基」→ 樹根不會主動拱破完整結構，多數破壞來自既有裂縫與土壤脹縮。',ARRAY['第11/2013號法律《文化遺產保護法》第106條', '中國《古樹名木保護條例》（2025年3月施行）分級標準', '市政署管護技術（斷層檢測儀、樹體修復技術課程）']::text[],10);
insert into public.conservation_topics (slug,category,title,summary,body_md,sources,sort_order) values ('faq','常見問題','常見問題 FAQ','澳門有多少古樹？最老的是哪一株？可以移植嗎？遊客能做什麼？','**Q：澳門現在有多少古樹？**

A：市政署 2025 年初統計為 **654 棵**古樹名木，以假菩提樹數量最多，主要分佈在澳門半島與離島舊城區。本平台使用的資料集為 **658 筆**紀錄（含個別「不分級」的後備／名木個案），與官方數字之差異源於名錄版本與統計時點不同。

**Q：最老的樹在哪裡、多少年？**

A：**海南蒲桃（樹齡 515 年）**，位於澳門區觀音古廟。名錄中另有 495 年與 365 年的海南蒲桃同處一地。

**Q：古樹可以移植嗎？**

A：**不可以。**《文化遺產保護法》第 106 條明確禁止移植或移除名錄內任何樹木，除非屬維護、重大公共利益，或由具職權部門宣告為預防危害公眾安全。

**Q：發現古樹有危險，該找誰？**

A：名錄樹木的所有人／持有人有義務立即通知**文化局**或具職權維護樹木的公共部門（市政署）。

**Q：樹上那個牌子和二維碼是什麼？**

A：那是古樹的「身份證」。掃碼可連到市政署的古樹名木網，查閱樹種、樹齡、健康情況與形態特徵。

**Q：遊客可以做什麼？**

A：使用本平台的「路綫推薦」走一條古樹徑；拍照不攀爬、不刻字、不採果、不踩踏樹根區；看到異常（枯枝、樹皮剝落、工地靠近）可向市政署反映。

**Q：這個平台的資料從哪裡來？**

A：樹木資料整理自澳門市政署《古樹名木保護名錄》（古樹.csv）；座標由 OpenStreetMap Nominatim 地理編碼並人工校核；物種相片為 Wikimedia Commons 自由授權圖片；地圖底圖為 OpenStreetMap。所有來源均在頁尾標示。',ARRAY['市政署：澳門現有古樹名木數量（新華社報導，2025-03-16，654 棵）', '本平台資料庫：658 筆紀錄，最老為 515 年海南蒲桃（觀音古廟）']::text[],11);

-- 立法時間線
insert into public.timeline_events (year,event_date,title,detail,source) values (1984,'1984','第 56/84/M 號法令','澳門首次系統保護「紀念物、建築群及場所」，建立受保護不動產概念，但未直接涵蓋樹木。','澳門政府公報第 27 期（1984-06-30）');
insert into public.timeline_events (year,event_date,title,detail,source) values (1992,'1992','第 83/92/M 號法令','擴充受保護不動產清單，部分古樹所在的花園與廟宇建築群被納入。','澳門政府公報第 52 期第四副刊（1992-12-31）');
insert into public.timeline_events (year,event_date,title,detail,source) values (2013,'2013-09-02','第 11/2013 號法律《文化遺產保護法》刊登','第 106 條首次把「古樹名木」定義為文化遺產的一類，並要求以行政長官批示核准《古樹名木保護名錄》。','澳門特別行政區公報第 36 期第一組');
insert into public.timeline_events (year,event_date,title,detail,source) values (2014,'2014-03-01','《文化遺產保護法》生效','禁止拔除、砍伐、毀損及移植名錄內樹木；名錄樹木所有人負有維護與通報義務。','第 11/2013 號法律');
insert into public.timeline_events (year,event_date,title,detail,source) values (2016,'2016-10-05','首次核准《古樹名木保護名錄》','第 333/2016 號行政長官批示，澳門古樹保護由「原則」進入「點名」階段。','澳門特別行政區公報第 40 期第一組');
insert into public.timeline_events (year,event_date,title,detail,source) values (2020,'2020-06-15 / 2020-11-16','兩度更新名錄','第 130/2020 號及第 216/2020 號行政長官批示先後更新《古樹名木保護名錄》。','澳門特別行政區公報第 24、46 期第一組');
insert into public.timeline_events (year,event_date,title,detail,source) values (2021,'2021-11-08','再次更新名錄','第 168/2021 號行政長官批示更新名錄；市政署同期成立古樹小組，專責實地檢查、管護與保育。','澳門特別行政區公報第 45 期第一組');
insert into public.timeline_events (year,event_date,title,detail,source) values (2024,'2024-07-22','第 118/2024 號行政長官批示','核准新版《古樹名木保護名錄》；同年第 4/2024 號行政法規訂定「澳門歷史城區」保護及管理計劃。','澳門特別行政區公報第 30 期第一組');
insert into public.timeline_events (year,event_date,title,detail,source) values (2026,'2026-01-05','第 279/2025 號行政長官批示（現行名錄）','核准現行《古樹名木保護名錄》，廢止第 118/2024 號批示。市政署表示將持續與內地科研單位合作加強管護。','澳門特別行政區公報第 1 期第一組');

-- 重設序列，確保後續 insert 不會撞號
select setval(pg_get_serial_sequence('public.species','id'), coalesce((select max(id) from public.species), 1));
select setval(pg_get_serial_sequence('public.sites','id'), coalesce((select max(id) from public.sites), 1));
select setval(pg_get_serial_sequence('public.trees','id'), coalesce((select max(id) from public.trees), 1));
select setval(pg_get_serial_sequence('public.routes','id'), coalesce((select max(id) from public.routes), 1));
select setval(pg_get_serial_sequence('public.conservation_topics','id'), coalesce((select max(id) from public.conservation_topics), 1));
select setval(pg_get_serial_sequence('public.timeline_events','id'), coalesce((select max(id) from public.timeline_events), 1));
commit;
