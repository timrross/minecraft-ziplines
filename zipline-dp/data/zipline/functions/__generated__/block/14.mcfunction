#built using mc-build (https://github.com/mc-build/mc-build)

playsound item.armor.equip_chain master @a ~ ~ ~ 1 .5
playsound item.armor.equip_chain master @a ~ ~ ~ 1 .5
effect clear @s levitation
scoreboard players set @s zip.move 0
give @s carrot_on_a_stick{CustomModelData:80006,display:{Name:'{"text":"Zipline Hook","color":"#bee9f4","italic":false}'},HideFlags:127,Unbreakable:1b,CustomModelData:80006}
item replace entity @s weapon.offhand with air