#built using mc-build (https://github.com/mc-build/mc-build)

execute as @a at @s run execute unless entity @e[type=marker,tag=front_zipline] run scoreboard players set @s zip.count 0
execute as @a[scores={lub.rightclick=1..},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80005}}}] at @s run execute as @e[type=marker,tag=front_zipline,distance=..5] at @s run function zipline:__generated__/block/0
execute as @a[scores={lub.rightclick=1..,zip.count=19..},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s run function zipline:__generated__/block/1
execute as @a[scores={lub.rightclick=1..,lub.sneak=1..,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s unless entity @e[type=marker,tag=zipline_start] run function zipline:__generated__/block/2
execute as @a[scores={lub.rightclick=1..,lub.sneak=1..,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s if entity @e[type=marker,tag=zipline_start] run function zipline:__generated__/block/3
execute as @a[scores={lub.rightclick=1..,lub.sneak=0..0,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s unless entity @e[type=marker,tag=zipline_start] run function zipline:__generated__/block/4
execute as @a[scores={lub.rightclick=1..,lub.sneak=0..0,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s if entity @e[type=marker,tag=zipline_start,distance=..100] run function zipline:__generated__/block/5
execute as @a[scores={lub.rightclick=1..,lub.sneak=0..0,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s if entity @e[type=marker,tag=zipline_start,distance=101..] run function zipline:__generated__/block/6
execute as @a[scores={lub.rightclick=1..,lub.sneak=1..,zip.count=..19},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80004}}}] at @s unless entity @e[type=marker,tag=zipline_start] run function zipline:__generated__/block/7
execute as @e[type=marker,tag=zipline_end] at @s run function zipline:__generated__/block/8
execute as @a[scores={lub.rightclick=1..},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80006}}}] at @s as @s[nbt=!{Inventory:[{Slot:-106b}]}] run function zipline:__generated__/block/10
execute as @a[scores={lub.rightclick=1..},nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick",tag:{CustomModelData:80006}}}] at @s as @s[nbt={Inventory:[{Slot:-106b}]}] run function zipline:__generated__/block/11
execute as @a at @s if score @s zip.move > 0 zip.constant run function zipline:__generated__/block/12
clear @a[scores={zip.move=0..0}] carrot_on_a_stick{CustomModelData:80007}
scoreboard players set @a lub.sneak 0
scoreboard players reset @a[scores={zip.move=0..0}] lub.rightclick